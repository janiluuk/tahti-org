// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ReleaseIdTrackIdParamsSchema,
  ReleaseTrackStemCompleteSchema,
  ReleaseTrackStemListSchema,
  ReleaseTrackStemParamsSchema,
  ReleaseTrackStemPrepareResponseSchema,
  ReleaseTrackStemPrepareSchema,
  ReleaseTrackStemViewSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { restrictionErrorMessage } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { serializeReleaseTrackStem } from '../../lib/release-track-stems.js'
import { presignedPutUrl } from '../../lib/minio.js'

const PRESIGN_TTL_SEC = 900
const ACCEPTED_FORMATS = ['audio/wav', 'audio/flac', 'audio/mpeg', 'audio/aac', 'audio/x-aiff']

const releaseTrackStemRoutes: FastifyPluginAsync = async (fastify) => {
  async function managedTrack(
    userId: string,
    isBoard: boolean,
    releaseId: string,
    trackId: string,
  ) {
    return fastify.prisma.releaseTrack.findFirst({
      where: {
        id: trackId,
        releaseId,
        ...(isBoard ? {} : { release: { userId } }),
      },
      select: {
        id: true,
        release: {
          select: {
            id: true,
            userId: true,
            user: { select: { username: true } },
          },
        },
      },
    })
  }

  fastify.get(
    '/api/me/releases/:releaseId/tracks/:trackId/stems',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ReleaseTrackStemListSchema, 'ReleaseTrackStemList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams

      const track = await managedTrack(user.id, user.isBoard, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const stems = await fastify.prisma.releaseTrackStem.findMany({
        where: { releaseTrackId: trackId },
        orderBy: { role: 'asc' },
      })

      return reply.send(await Promise.all(stems.map((stem) => serializeReleaseTrackStem(stem))))
    },
  )

  fastify.post(
    '/api/me/releases/:releaseId/tracks/:trackId/stems/prepare',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(
          ReleaseTrackStemPrepareResponseSchema,
          'ReleaseTrackStemPrepareResponse',
        ),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseTrackStemPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const uploadBanError = await restrictionErrorMessage(fastify.prisma, user.id, 'UPLOAD')
      if (uploadBanError) return reply.status(403).send({ error: uploadBanError })

      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams
      const track = await managedTrack(user.id, user.isBoard, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      if (!ACCEPTED_FORMATS.includes(parsed.data.contentType)) {
        return reply.status(400).send({
          error: `Unsupported format. Accepted: ${ACCEPTED_FORMATS.join(', ')}`,
        })
      }

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'mp3'
      const uploadId = `releases/${track.release.user.username}/${releaseId}/${trackId}-stem-${parsed.data.role}-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadId, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({
        uploadId,
        uploadUrl,
        expiresAt,
        role: parsed.data.role,
      })
    },
  )

  fastify.post(
    '/api/me/releases/:releaseId/tracks/:trackId/stems/complete',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          {
            status: 201,
            schema: ReleaseTrackStemViewSchema,
            name: 'ReleaseTrackStemView',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseTrackStemCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseIdTrackIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId } = routeParams
      const track = await managedTrack(user.id, user.isBoard, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const prefix = `releases/${track.release.user.username}/${releaseId}/${trackId}-stem-${parsed.data.role}-`
      if (!parsed.data.uploadId.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this track stem' })
      }

      const stem = await fastify.prisma.releaseTrackStem.upsert({
        where: {
          releaseTrackId_role: {
            releaseTrackId: trackId,
            role: parsed.data.role,
          },
        },
        create: {
          releaseTrackId: trackId,
          role: parsed.data.role,
          sourceKey: parsed.data.uploadId,
          streamKey: parsed.data.uploadId,
          durationSec: parsed.data.durationSec ?? null,
          status: 'READY',
        },
        update: {
          sourceKey: parsed.data.uploadId,
          streamKey: parsed.data.uploadId,
          durationSec: parsed.data.durationSec ?? null,
          status: 'READY',
        },
      })

      return reply.status(201).send(await serializeReleaseTrackStem(stem))
    },
  )

  fastify.delete(
    '/api/me/releases/:releaseId/tracks/:trackId/stems/:stemId',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'Remove one stem from a release track',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackStemParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { releaseId, trackId, stemId } = routeParams

      const track = await managedTrack(user.id, user.isBoard, releaseId, trackId)
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const stem = await fastify.prisma.releaseTrackStem.findFirst({
        where: { id: stemId, releaseTrackId: trackId },
        select: { id: true },
      })
      if (!stem) return reply.status(404).send({ error: 'Stem not found' })

      await fastify.prisma.releaseTrackStem.delete({ where: { id: stem.id } })
      return reply.status(204).send()
    },
  )
}

export default releaseTrackStemRoutes
