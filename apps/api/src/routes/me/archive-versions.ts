// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ArchiveVersionCompleteSchema,
  ArchiveVersionCreatedSchema,
  ArchiveVersionDownloadSchema,
  ArchiveVersionListSchema,
  ArchiveVersionParamsSchema,
  ArchiveVersionPrepareResponseSchema,
  ArchiveVersionPrepareSchema,
  ArchiveVersionViewSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, presignedGetUrl } from '../../lib/minio.js'
import { enqueueVersionTranscode, getMediaJob } from '../../lib/queue.js'
import { ensureInitialVersion, syncActiveVersionToItem } from '@tahti/db'
import { serializeArchiveVersion } from '../../lib/archive-versions.js'

const PRESIGN_TTL_SEC = 900

const meArchiveVersionRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channel: { userId } },
      select: { id: true, channel: { select: { slug: true } } },
    })
  }

  fastify.get(
    '/api/me/archive/:id/versions',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ArchiveVersionListSchema, 'ArchiveVersionList') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      await ensureInitialVersion(fastify.prisma, id)

      const versions = await fastify.prisma.archiveItemVersion.findMany({
        where: { archiveItemId: id },
        orderBy: { versionNumber: 'asc' },
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          status: true,
          isActive: true,
          durationSec: true,
          sourceFormat: true,
          sourceBitrateKbps: true,
          createdAt: true,
        },
      })

      return reply.send(versions.map(serializeArchiveVersion))
    },
  )

  fastify.get(
    '/api/me/archive/:id/versions/:versionId',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ArchiveVersionViewSchema, 'ArchiveVersionView') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ArchiveVersionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id, versionId } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const version = await fastify.prisma.archiveItemVersion.findFirst({
        where: { id: versionId, archiveItemId: id },
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          status: true,
          isActive: true,
          durationSec: true,
          sourceFormat: true,
          sourceBitrateKbps: true,
          createdAt: true,
        },
      })
      if (!version) return reply.status(404).send({ error: 'Version not found' })

      return reply.send(serializeArchiveVersion(version))
    },
  )

  /** UX-12: presigned download for rendered preview/export files. */
  fastify.get(
    '/api/me/archive/:id/versions/:versionId/download',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ArchiveVersionDownloadSchema, 'ArchiveVersionDownload'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ArchiveVersionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id, versionId } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const version = await fastify.prisma.archiveItemVersion.findFirst({
        where: { id: versionId, archiveItemId: id },
        select: { rawKey: true, mp3Key: true, flacKey: true, status: true },
      })
      if (!version || version.status !== 'READY') {
        return reply.status(404).send({ error: 'Version not ready for download' })
      }

      const key = version.mp3Key ?? version.flacKey ?? version.rawKey
      const contentType = version.mp3Key
        ? 'audio/mpeg'
        : version.flacKey
          ? 'audio/flac'
          : 'application/octet-stream'
      const url = await presignedGetUrl(key, PRESIGN_TTL_SEC)
      return reply.send({ url, contentType })
    },
  )

  /** PERF-08: SSE progress for server-side edit render jobs. */
  fastify.get(
    '/api/me/archive/:id/versions/:versionId/progress',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ArchiveVersionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id, versionId } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const version = await fastify.prisma.archiveItemVersion.findFirst({
        where: { id: versionId, archiveItemId: id },
        select: { id: true, status: true },
      })
      if (!version) return reply.status(404).send({ error: 'Version not found' })

      reply.hijack()
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      })

      let closed = false
      request.raw.on('close', () => {
        closed = true
      })

      const send = (payload: Record<string, unknown>) => {
        if (closed) return
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)
      }

      const tick = async (): Promise<void> => {
        if (closed) return

        const current = await fastify.prisma.archiveItemVersion.findFirst({
          where: { id: versionId, archiveItemId: id },
          select: { status: true, versionNumber: true, versionLabel: true },
        })
        if (!current) {
          send({ status: 'ERROR', pct: 0, phase: 'missing' })
          reply.raw.end()
          return
        }

        const job = await getMediaJob(`render-archive-edit-${versionId}`)
        const rawProgress = job?.progress as
          | { pct?: number; phase?: string; segment?: number; segmentCount?: number }
          | number
          | undefined
        const pct =
          typeof rawProgress === 'number'
            ? rawProgress
            : typeof rawProgress?.pct === 'number'
              ? rawProgress.pct
              : current.status === 'READY'
                ? 1
                : 0

        send({
          status: current.status,
          pct,
          phase: typeof rawProgress === 'object' ? rawProgress?.phase : undefined,
          segment: typeof rawProgress === 'object' ? rawProgress?.segment : undefined,
          segmentCount: typeof rawProgress === 'object' ? rawProgress?.segmentCount : undefined,
          versionNumber: current.versionNumber,
          versionLabel: current.versionLabel,
        })

        if (current.status === 'READY' || current.status === 'ERROR') {
          reply.raw.end()
          return
        }

        setTimeout(() => {
          void tick()
        }, 500)
      }

      void tick()
    },
  )

  fastify.post(
    '/api/me/archive/:id/versions/prepare',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(
          ArchiveVersionPrepareResponseSchema,
          'ArchiveVersionPrepareResponse',
        ),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveVersionPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'mp3'
      const uploadId = `raw/${item.channel.slug}/${nanoid(16)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadId, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadId, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/archive/:id/versions/complete',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: ArchiveVersionCreatedSchema, name: 'ArchiveVersionCreated' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ArchiveVersionCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const { uploadId, versionLabel, fileSizeBytes } = parsed.data
      if (!uploadId.startsWith(`raw/${item.channel.slug}/`)) {
        return reply.status(403).send({ error: 'Upload does not belong to your channel' })
      }

      await ensureInitialVersion(fastify.prisma, id)

      const count = await fastify.prisma.archiveItemVersion.count({
        where: { archiveItemId: id },
      })

      const version = await fastify.prisma.archiveItemVersion.create({
        data: {
          archiveItemId: id,
          versionNumber: count + 1,
          versionLabel: versionLabel.trim(),
          rawKey: uploadId,
          fileSizeBytes: fileSizeBytes ?? 0,
          status: 'PENDING',
          isActive: false,
        },
        select: { id: true, versionNumber: true, versionLabel: true, status: true },
      })

      await enqueueVersionTranscode(version.id)

      return reply.status(201).send({
        versionId: version.id,
        versionNumber: version.versionNumber,
        versionLabel: version.versionLabel,
        status: version.status,
      })
    },
  )

  fastify.post(
    '/api/me/archive/:id/versions/:versionId/activate',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ArchiveVersionListSchema, 'ArchiveVersionList') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ArchiveVersionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id, versionId } = routeParams

      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const version = await fastify.prisma.archiveItemVersion.findFirst({
        where: { id: versionId, archiveItemId: id },
      })
      if (!version) return reply.status(404).send({ error: 'Version not found' })
      if (version.status !== 'READY') {
        return reply.status(400).send({ error: 'Version is not ready yet' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.archiveItemVersion.updateMany({
          where: { archiveItemId: id },
          data: { isActive: false },
        }),
        fastify.prisma.archiveItemVersion.update({
          where: { id: versionId },
          data: { isActive: true },
        }),
      ])

      await syncActiveVersionToItem(fastify.prisma, id)

      const versions = await fastify.prisma.archiveItemVersion.findMany({
        where: { archiveItemId: id },
        orderBy: { versionNumber: 'asc' },
        select: {
          id: true,
          versionNumber: true,
          versionLabel: true,
          status: true,
          isActive: true,
          durationSec: true,
          sourceFormat: true,
          sourceBitrateKbps: true,
          createdAt: true,
        },
      })

      return reply.send(versions.map(serializeArchiveVersion))
    },
  )
}

export default meArchiveVersionRoutes
