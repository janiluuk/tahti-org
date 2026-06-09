// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  IdParamSchema,
  ReleaseArtworkCompleteSchema,
  ReleaseArtworkCompleteResponseSchema,
  ReleaseArtworkPrepareSchema,
  ReleaseArtworkPrepareResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'
import { extractPalette } from '../../lib/palette-extract.js'

const PRESIGN_TTL_SEC = 900
const releaseArtworkRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedRelease(userId: string, releaseId: string) {
    return fastify.prisma.release.findFirst({
      where: { id: releaseId, userId },
      select: { id: true, user: { select: { username: true } } },
    })
  }

  fastify.post(
    '/api/me/releases/:id/artwork/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseArtworkPrepareResponseSchema, 'ReleaseArtworkPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseArtworkPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const release = await ownedRelease(user.id, id)
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `releases/${release.user.username}/${id}/artwork-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/releases/:id/artwork/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseArtworkCompleteResponseSchema, 'ReleaseArtworkComplete'),
      },
    },
    async (request, reply) => {
      const parsed = ReleaseArtworkCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const release = await ownedRelease(user.id, id)
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const prefix = `releases/${release.user.username}/${id}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this release' })
      }

      const updated = await fastify.prisma.release.update({
        where: { id },
        data: { artworkKey: parsed.data.uploadKey, artworkUrl: null },
        select: { id: true, artworkKey: true, artworkUrl: true },
      })

      const artworkUrl = await resolveReleaseArtworkUrl(updated)

      // Fire-and-forget palette extraction — don't block the response
      if (artworkUrl) {
        extractPalette(artworkUrl).then((palette) => {
          if (!palette) return
          return fastify.prisma.release.update({
            where: { id },
            data: { paletteJson: JSON.stringify(palette) },
          })
        }).catch(() => undefined)
      }

      return reply.send({ artworkUrl, artworkKey: updated.artworkKey })
    },
  )
}

export default releaseArtworkRoutes
