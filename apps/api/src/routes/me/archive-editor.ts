// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createDefaultEditList, validateEditList } from '@tahti/audio-edit'
import {
  ArchiveEditListDraftPatchResponseSchema,
  ArchiveEditListDraftPatchSchema,
  ArchiveEditListDraftResponseSchema,
  ArchiveEditListRenderResponseSchema,
  ArchiveEditListRenderSchema,
  ArchiveEditorPublishResponseSchema,
  ArchiveEditorPublishSchema,
  ArchiveEditorSourceSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { resolveArchiveEditorSource } from '../../lib/archive-editor-source.js'
import { getObjectStream, presignedGetUrl } from '../../lib/minio.js'
import {
  enqueueBackfillEditorPeaks,
  enqueueRenderArchiveEdit,
  mediaQueue,
} from '../../lib/queue.js'
import { ensureInitialVersion } from '@tahti/db'

const MAX_CONCURRENT_EDITOR_JOBS = 2

const meArchiveEditorRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channel: { userId } },
      select: {
        id: true,
        title: true,
        durationSec: true,
        editList: true,
        tracklist: true,
        editorPeaks: true,
        updatedAt: true,
        channel: { select: { slug: true } },
      },
    })
  }

  async function countActiveEditorJobs(userId: string): Promise<number> {
    return fastify.prisma.archiveItemVersion.count({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        archiveItem: { channel: { userId } },
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

      if (!item.editorPeaks) {
        void enqueueBackfillEditorPeaks(id).catch(() => {})
      }

      return reply.send({
        editList: { ...editList, sourceDuration: Math.max(editList.sourceDuration, duration) },
        updatedAt: item.updatedAt.toISOString(),
        tracklist: Array.isArray(item.tracklist) ? item.tracklist : null,
        editorPeaks: item.editorPeaks ?? null,
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

      const { expectedUpdatedAt } = parsed.data

      if (expectedUpdatedAt) {
        const result = await fastify.prisma.archiveItem.updateMany({
          where: { id, updatedAt: new Date(expectedUpdatedAt) },
          data: { editList: validation.edit },
        })
        if (result.count === 0) {
          const current = await fastify.prisma.archiveItem.findUnique({
            where: { id },
            select: { updatedAt: true },
          })
          return reply.status(409).send({
            error: 'Draft was updated elsewhere — reload to avoid overwriting',
            updatedAt: current?.updatedAt.toISOString() ?? null,
          })
        }
        const updated = await fastify.prisma.archiveItem.findUniqueOrThrow({
          where: { id },
          select: { updatedAt: true },
        })
        return reply.send({ ok: true as const, updatedAt: updated.updatedAt.toISOString() })
      }

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
      const sourceFileSizeBytes = source.fileSizeBytes != null ? Number(source.fileSizeBytes) : null
      return reply.send({
        url,
        durationSec: source.durationSec,
        title: source.title,
        sourceKey: source.sourceKey,
        sourceFileSizeBytes,
      })
    },
  )

  fastify.get(
    '/api/me/archive/:id/editor/stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor: same-origin audio stream with CORP for COEP pages',
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

      const { body, contentType, contentLength } = await getObjectStream(source.sourceKey)
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'private, no-store')
      if (contentLength != null) reply.header('Content-Length', String(contentLength))
      return reply.send(body)
    },
  )

  fastify.post(
    '/api/me/archive/:id/editor/bounce',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'REMOVED — use POST …/editor/render with EditList.',
      },
    },
    async (request, reply) => {
      reply.header('Deprecation', 'true')
      reply.header('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT')
      reply.header('Link', '</api/me/archive/{id}/editor/render>; rel="successor-version"')
      request.log.warn('Removed editor/bounce — clients must use editor/render with EditList')
      return reply.status(410).send({
        error:
          'POST …/editor/bounce is removed. Use POST …/editor/render with EditList (v0 trim: editListFromV0Trim in @tahti/audio-edit).',
      })
    },
  )

  fastify.post(
    '/api/me/archive/:id/editor/render',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: server-side render of EditList via native ffmpeg (Render B)',
        response: openApiResponses([
          {
            status: 202,
            schema: ArchiveEditListRenderResponseSchema,
            name: 'ArchiveEditListRender',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveEditListRenderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const validation = validateEditList(parsed.data.editList)
      if (!validation.ok || !validation.edit) {
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

      const source = await resolveArchiveEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Archive item is not ready for editing' })
      }

      const { versionLabel, activate, format, maxDurationSec, sampleOnly } = parsed.data
      const editList = validation.edit

      if ((await countActiveEditorJobs(user.id)) >= MAX_CONCURRENT_EDITOR_JOBS) {
        return reply.status(429).send({ error: 'Too many editor renders in progress (max 2)' })
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

      await enqueueRenderArchiveEdit({
        versionId: version.id,
        archiveItemId: id,
        channelSlug: item.channel.slug,
        sourceKey: source.sourceKey,
        editList,
        format,
        activate,
        maxDurationSec,
        sampleOnly,
      })

      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_EDIT_RENDER',
        actorId: user.id,
        targetId: id,
        meta: {
          versionId: version.id,
          versionNumber: version.versionNumber,
          format,
          activate,
          cutCount: editList.cuts.length,
          maxDurationSec,
          sampleOnly: sampleOnly ?? false,
        },
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

      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_EDIT_PUBLISH',
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

export default meArchiveEditorRoutes
