// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createDefaultEditList, validateEditList } from '@tahti/audio-edit'
import {
  ArchiveEditListDraftPatchResponseSchema,
  ArchiveEditListDraftPatchSchema,
  ArchiveEditListDraftResponseSchema,
  ArchiveEditorBounceResponseSchema,
  ArchiveEditorBounceSchema,
  ArchiveEditorPublishResponseSchema,
  ArchiveEditorPublishSchema,
  ArchiveEditorSourceSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveArchiveEditorSource } from '../../lib/archive-editor-source.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { enqueueBounceArchiveEdit, mediaQueue } from '../../lib/queue.js'
import { ensureInitialVersion } from '@tahti/db'

const meArchiveEditorRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channel: { userId } },
      select: {
        id: true,
        title: true,
        durationSec: true,
        editList: true,
        updatedAt: true,
        channel: { select: { slug: true } },
      },
    })
  }

  fastify.get(
    '/api/me/archive/:id/editor/draft',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: load persisted EditList draft',
        response: openApiResponse(ArchiveEditListDraftResponseSchema, 'ArchiveEditListDraft'),
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

      const duration = source.durationSec ?? item.durationSec ?? 60
      const stored = item.editList
      const validation = stored ? validateEditList(stored) : { ok: false as const, issues: [] }
      const editList =
        validation.ok && validation.edit
          ? validation.edit
          : createDefaultEditList(Math.max(1, duration))

      return reply.send({
        editList: { ...editList, sourceDuration: Math.max(editList.sourceDuration, duration) },
        updatedAt: item.updatedAt.toISOString(),
      })
    },
  )

  fastify.patch(
    '/api/me/archive/:id/editor/draft',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: autosave EditList draft',
        response: openApiResponse(
          ArchiveEditListDraftPatchResponseSchema,
          'ArchiveEditListDraftPatch',
        ),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveEditListDraftPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const validation = validateEditList(parsed.data.editList)
      if (!validation.ok) {
        return reply.status(400).send({
          error: validation.issues[0]?.message ?? 'Invalid edit list',
          issues: validation.issues,
        })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const updated = await fastify.prisma.archiveItem.update({
        where: { id },
        data: { editList: validation.edit },
        select: { updatedAt: true },
      })

      return reply.send({ ok: true as const, updatedAt: updated.updatedAt.toISOString() })
    },
  )

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
        highPassHz,
        lowPassHz,
        eq,
        compressorEnabled,
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
        highPassHz,
        lowPassHz,
        eq,
        compressorEnabled,
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

  // PLAT-069: bounce a READY archive (or specific version) into a release track
  fastify.post(
    '/api/me/archive/:id/editor/publish-to-release',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Publish an archive recording (or one of its versions) as a release track',
        response: openApiResponses([
          {
            status: 201,
            schema: ArchiveEditorPublishResponseSchema,
            name: 'ArchiveEditorPublish',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveEditorPublishSchema.safeParse(request.body)
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

      const { releaseId, versionId, title } = parsed.data

      let sourceKey: string | null = null
      if (versionId) {
        const version = await fastify.prisma.archiveItemVersion.findFirst({
          where: { id: versionId, archiveItemId: id },
          select: { rawKey: true, status: true },
        })
        if (!version) return reply.status(404).send({ error: 'Version not found' })
        if (version.status !== 'READY') {
          return reply.status(400).send({ error: 'Version is not ready yet' })
        }
        sourceKey = version.rawKey
      } else {
        const source = await resolveArchiveEditorSource(fastify.prisma, id)
        if (!source) {
          return reply.status(409).send({ error: 'Archive item is not ready for editing' })
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
          archiveItemId: id,
          sourceKey,
          status: 'SCANNING',
        },
        select: { id: true, status: true },
      })

      await mediaQueue.add('transcode-release-track', { trackId: track.id })

      return reply.status(201).send({
        ok: true as const,
        trackId: track.id,
        status: track.status,
      })
    },
  )
}

export default meArchiveEditorRoutes
