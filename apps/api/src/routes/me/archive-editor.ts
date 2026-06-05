// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArchiveEditorBounceResponseSchema,
  ArchiveEditorBounceSchema,
  ArchiveEditorSourceSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveArchiveEditorSource } from '../../lib/archive-editor-source.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { enqueueBounceArchiveEdit } from '../../lib/queue.js'
import { ensureInitialVersion } from '@tahti/db'

const meArchiveEditorRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channel: { userId } },
      select: { id: true, channel: { select: { slug: true } } },
    })
  }

  fastify.get(
    '/api/me/archive/:id/editor/source',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v0: presigned URL to preview archive audio for trim editor',
        response: openApiResponse(ArchiveEditorSourceSchema, 'ArchiveEditorSource'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const source = await resolveArchiveEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Archive item is not ready for editing' })
      }

      const url = await presignedGetUrl(source.sourceKey, 3600)
      return reply.send({
        url,
        durationSec: source.durationSec,
        title: source.title,
        sourceKey: source.sourceKey,
      })
    },
  )

  fastify.post(
    '/api/me/archive/:id/editor/bounce',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v0: trim/fade bounce → new archive version',
        response: openApiResponses([
          { status: 202, schema: ArchiveEditorBounceResponseSchema, name: 'ArchiveEditorBounce' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveEditorBounceSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const source = await resolveArchiveEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Archive item is not ready for editing' })
      }

      const {
        startSec,
        endSec,
        fadeInSec,
        fadeOutSec,
        peakNormalize,
        lufsTarget,
        limiterEnabled,
        versionLabel,
        activate,
      } = parsed.data

      if (endSec <= startSec) {
        return reply.status(400).send({ error: 'End must be after start' })
      }

      const clipDuration = endSec - startSec
      if (source.durationSec != null && endSec > source.durationSec + 0.5) {
        return reply.status(400).send({ error: 'End time exceeds track duration' })
      }
      if (clipDuration < 1) {
        return reply.status(400).send({ error: 'Selection must be at least 1 second' })
      }
      if (fadeInSec + fadeOutSec >= clipDuration) {
        return reply
          .status(400)
          .send({ error: 'Fade in + fade out must be shorter than selection' })
      }

      await ensureInitialVersion(fastify.prisma, id)
      const versionCount = await fastify.prisma.archiveItemVersion.count({
        where: { archiveItemId: id },
      })

      const version = await fastify.prisma.archiveItemVersion.create({
        data: {
          archiveItemId: id,
          versionNumber: versionCount + 1,
          versionLabel,
          rawKey: `pending/${item.channel.slug}/${id}`,
          fileSizeBytes: 0,
          status: 'PENDING',
          isActive: false,
        },
        select: { id: true, versionNumber: true, status: true },
      })

      await enqueueBounceArchiveEdit({
        versionId: version.id,
        archiveItemId: id,
        channelSlug: item.channel.slug,
        sourceKey: source.sourceKey,
        startSec,
        endSec,
        fadeInSec,
        fadeOutSec,
        peakNormalize,
        lufsTarget,
        limiterEnabled,
        activate,
      })

      return reply.status(202).send({
        ok: true as const,
        versionId: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
      })
    },
  )
}

export default meArchiveEditorRoutes
