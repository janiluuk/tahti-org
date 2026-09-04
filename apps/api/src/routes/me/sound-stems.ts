// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundDownloadResponseSchema,
  SoundStemsResponseSchema,
  IdParamSchema,
  RequestStemsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { enqueueSeparateStems } from '../../lib/queue.js'

const STEM_FIELD_LABELS: Record<string, string> = {
  vocalsKey: 'Vocals',
  instrumentalKey: 'Instrumental',
  drumsKey: 'Drums',
  bassKey: 'Bass',
  otherKey: 'Other',
}

const meSoundStemsRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.sound.findFirst({
      where: { id: itemId, channel: { userId } },
      select: {
        id: true,
        title: true,
        rawKey: true,
        flacKey: true,
        mp3Key: true,
        channel: { select: { slug: true } },
      },
    })
  }

  // Original file download — doesn't exist elsewhere in the sound routes.
  // Prefers the best available source: lossless raw > FLAC derivative > MP3.
  fastify.get(
    '/api/me/sound/:id/download',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Presigned URL to download the original (best available) audio file',
        response: openApiResponse(SoundDownloadResponseSchema, 'SoundDownload'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await ownedItem(request.sessionUser!.id, routeParams.id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const key = item.rawKey ?? item.flacKey ?? item.mp3Key
      if (!key) return reply.status(409).send({ error: 'No downloadable file for this item yet' })

      const ext = key.includes('.') ? key.split('.').pop() : 'audio'
      const filename = `${item.title}.${ext}`
      const url = await presignedGetUrl(key, 3600, filename)
      return reply.send({ url, filename })
    },
  )

  fastify.get(
    '/api/me/sound/:id/stems',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Status of any stem-separation jobs for this track',
        response: openApiResponse(SoundStemsResponseSchema, 'SoundStems'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await ownedItem(request.sessionUser!.id, routeParams.id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const rows = await fastify.prisma.soundStemJob.findMany({
        where: { soundId: routeParams.id },
      })

      const jobs = await Promise.all(
        rows.map(async (row) => {
          const files: { label: string; url: string }[] = []
          if (row.status === 'READY') {
            for (const [field, label] of Object.entries(STEM_FIELD_LABELS)) {
              const key = (row as unknown as Record<string, string | null>)[field]
              if (key) files.push({ label, url: await presignedGetUrl(key, 3600) })
            }
          }
          return {
            stemSet: row.stemSet,
            status: row.status,
            errorMessage: row.errorMessage,
            files,
          }
        }),
      )

      return reply.send({ jobs })
    },
  )

  fastify.post(
    '/api/me/sound/:id/stems/render',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Kick off (or re-check) UVR5-family stem separation for this track',
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RequestStemsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const item = await ownedItem(request.sessionUser!.id, routeParams.id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const sourceKey = item.rawKey ?? item.flacKey ?? item.mp3Key
      if (!sourceKey) {
        return reply.status(409).send({ error: 'No source audio available to separate yet' })
      }

      const existing = await fastify.prisma.soundStemJob.findUnique({
        where: {
          soundId_stemSet: { soundId: routeParams.id, stemSet: parsed.data.stemSet },
        },
      })
      if (existing && (existing.status === 'PENDING' || existing.status === 'PROCESSING')) {
        return reply.status(202).send({ status: existing.status })
      }
      if (existing && existing.status === 'READY') {
        return reply.status(200).send({ status: 'READY' })
      }

      const stemJob = await fastify.prisma.soundStemJob.upsert({
        where: {
          soundId_stemSet: { soundId: routeParams.id, stemSet: parsed.data.stemSet },
        },
        create: {
          soundId: routeParams.id,
          requestedById: request.sessionUser!.id,
          stemSet: parsed.data.stemSet,
          status: 'PENDING',
        },
        update: { status: 'PENDING', errorMessage: null },
      })

      await enqueueSeparateStems({
        stemJobId: stemJob.id,
        soundId: routeParams.id,
        sourceKey,
        stemSet: parsed.data.stemSet,
      })

      return reply.status(202).send({ status: 'PENDING' })
    },
  )
}

export default meSoundStemsRoutes
