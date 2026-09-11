// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundEditorPublishResponseSchema,
  SoundEditorPublishSchema,
  IdParamSchema,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { resolveSoundEditorSource } from '../../lib/sound-editor-source.js'
import { mediaQueue } from '../../lib/queue.js'
import { ownedItem } from './sound-editor-helpers.js'

const meSoundEditorPublishRoutes: FastifyPluginAsync = async (fastify) => {
  // PLAT-069: bounce a READY sound (or specific version) into a release track
  fastify.post(
    '/api/me/sound/:id/editor/publish-to-release',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Publish an sound recording (or one of its versions) as a release track',
        response: openApiResponses([
          {
            status: 201,
            schema: SoundEditorPublishResponseSchema,
            name: 'SoundEditorPublish',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = SoundEditorPublishSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(fastify, user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const { releaseId, versionId, title } = parsed.data

      let sourceKey: string | null = null
      if (versionId) {
        const version = await fastify.prisma.soundVersion.findFirst({
          where: { id: versionId, soundId: id },
          select: { rawKey: true, status: true },
        })
        if (!version) return reply.status(404).send({ error: 'Version not found' })
        if (version.status !== 'READY') {
          return reply.status(400).send({ error: 'Version is not ready yet' })
        }
        sourceKey = version.rawKey
      } else {
        const source = await resolveSoundEditorSource(fastify.prisma, id)
        if (!source) {
          return reply.status(409).send({ error: 'Sound item is not ready for editing' })
        }
        sourceKey = source.sourceKey
      }

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
        include: { _count: { select: { tracks: true } } },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.create({
        data: {
          releaseId,
          position: release._count.tracks + 1,
          title: title?.trim() || item.title,
          soundId: id,
          sourceKey,
          status: 'SCANNING',
        },
        select: { id: true, status: true },
      })

      await mediaQueue.add('transcode-release-track', { trackId: track.id })

      await auditLog(fastify.prisma, {
        action: 'SOUND_EDIT_PUBLISH',
        actorId: user.id,
        targetId: id,
        meta: { trackId: track.id, releaseId, versionId: versionId ?? null },
      })

      return reply.status(201).send({
        ok: true as const,
        trackId: track.id,
        status: track.status,
      })
    },
  )
}

export default meSoundEditorPublishRoutes
