// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  AnnouncementClipListSchema,
  AnnouncementClipViewSchema,
  AnnouncementEditorRenderResponseSchema,
  AnnouncementEditorRenderSchema,
  AnnouncementEditorSourceSchema,
  AnnouncementSettingsSchema,
  CompleteAnnouncementUploadSchema,
  IdParamSchema,
  PatchAnnouncementClipSchema,
  PrepareAnnouncementUploadResponseSchema,
  PrepareAnnouncementUploadSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { presignedGetUrl, presignedPutUrl } from '../../lib/minio.js'
import { enqueueRenderAnnouncementTrim } from '../../lib/queue.js'

const PRESIGN_TTL_SEC = 900

const CLIP_SELECT = {
  id: true,
  title: true,
  durationSec: true,
  isEnabled: true,
  scheduleMode: true,
  everyNth: true,
  position: true,
  renderStatus: true,
  createdAt: true,
} as const

const adminAnnouncementsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/announcements/prepare — system-wide announcement upload
  fastify.post(
    '/api/admin/announcements/prepare',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          PrepareAnnouncementUploadResponseSchema,
          'PrepareAnnouncementUpload',
        ),
      },
    },
    async (request, reply) => {
      const parsed = PrepareAnnouncementUploadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const { filename, contentType, fileSizeBytes } = parsed.data

      const ext = filename.includes('.') ? filename.split('.').pop() : 'mp3'
      const uploadId = `announcements/system/${nanoid(16)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadId, contentType, PRESIGN_TTL_SEC, fileSizeBytes)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadId, uploadUrl, expiresAt })
    },
  )

  // POST /api/admin/announcements/complete
  fastify.post(
    '/api/admin/announcements/complete',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnouncementClipViewSchema, 'AnnouncementClip'),
      },
    },
    async (request, reply) => {
      const parsed = CompleteAnnouncementUploadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const { uploadId, title, durationSec } = parsed.data
      if (!uploadId.startsWith('announcements/system/')) {
        return reply.status(403).send({ error: 'Not a system announcement upload' })
      }

      const clip = await fastify.prisma.announcementClip.create({
        data: {
          channelId: null,
          title,
          audioKey: uploadId,
          originalAudioKey: uploadId,
          durationSec,
        },
        select: CLIP_SELECT,
      })
      return reply.status(201).send(clip)
    },
  )

  // GET /api/admin/announcements
  fastify.get(
    '/api/admin/announcements',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnouncementClipListSchema, 'AnnouncementClipList'),
      },
    },
    async (_request, reply) => {
      const clips = await fastify.prisma.announcementClip.findMany({
        where: { channelId: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        select: CLIP_SELECT,
      })
      return reply.send({ clips })
    },
  )

  // PATCH /api/admin/announcements/:id — full schedule control for system clips
  fastify.patch(
    '/api/admin/announcements/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchAnnouncementClipSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      if (parsed.data.scheduleMode === 'EVERY_NTH' && parsed.data.everyNth == null) {
        return reply.status(400).send({ error: 'everyNth is required for EVERY_NTH scheduling' })
      }

      const existing = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: null },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Announcement not found' })

      const clip = await fastify.prisma.announcementClip.update({
        where: { id: routeParams.id },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.isEnabled !== undefined ? { isEnabled: parsed.data.isEnabled } : {}),
          ...(parsed.data.scheduleMode !== undefined
            ? { scheduleMode: parsed.data.scheduleMode }
            : {}),
          ...(parsed.data.everyNth !== undefined ? { everyNth: parsed.data.everyNth } : {}),
          ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
        },
        select: CLIP_SELECT,
      })
      return reply.send(clip)
    },
  )

  // DELETE /api/admin/announcements/:id
  fastify.delete(
    '/api/admin/announcements/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.announcementClip.deleteMany({
        where: { id: routeParams.id, channelId: null },
      })
      if (count === 0) return reply.status(404).send({ error: 'Announcement not found' })
      return reply.status(204).send()
    },
  )

  // GET/PATCH /api/admin/announcements/settings — global kill-switch
  fastify.get(
    '/api/admin/announcements/settings',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnouncementSettingsSchema, 'AnnouncementSettings'),
      },
    },
    async (_request, reply) => {
      const settings = await fastify.prisma.announcementSettings.findUnique({
        where: { id: 'global' },
      })
      return reply.send({ systemEnabled: settings?.systemEnabled ?? true })
    },
  )

  fastify.patch(
    '/api/admin/announcements/settings',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnouncementSettingsSchema, 'AnnouncementSettings'),
      },
    },
    async (request, reply) => {
      const parsed = AnnouncementSettingsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const settings = await fastify.prisma.announcementSettings.upsert({
        where: { id: 'global' },
        create: { id: 'global', systemEnabled: parsed.data.systemEnabled },
        update: { systemEnabled: parsed.data.systemEnabled },
      })
      return reply.send({ systemEnabled: settings.systemEnabled })
    },
  )

  // GET /api/admin/announcements/:id/editor/source
  fastify.get(
    '/api/admin/announcements/:id/editor/source',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnouncementEditorSourceSchema, 'AnnouncementEditorSource'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const clip = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: null },
        select: {
          title: true,
          audioKey: true,
          originalAudioKey: true,
          durationSec: true,
          renderStatus: true,
        },
      })
      if (!clip) return reply.status(404).send({ error: 'Announcement not found' })

      const [url, originalUrl] = await Promise.all([
        presignedGetUrl(clip.audioKey, 3600),
        presignedGetUrl(clip.originalAudioKey, 3600),
      ])

      return reply.send({
        url,
        originalUrl,
        durationSec: clip.durationSec,
        title: clip.title,
        renderStatus: clip.renderStatus,
      })
    },
  )

  // POST /api/admin/announcements/:id/editor/render
  fastify.post(
    '/api/admin/announcements/:id/editor/render',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          AnnouncementEditorRenderResponseSchema,
          'AnnouncementEditorRender',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = AnnouncementEditorRenderSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const clip = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: null },
        select: { originalAudioKey: true },
      })
      if (!clip) return reply.status(404).send({ error: 'Announcement not found' })

      await fastify.prisma.announcementClip.update({
        where: { id: routeParams.id },
        data: { renderStatus: 'PROCESSING' },
      })

      await enqueueRenderAnnouncementTrim({
        clipId: routeParams.id,
        sourceKey: clip.originalAudioKey,
        outputKeyPrefix: 'announcements/system',
        startSec: parsed.data.startSec,
        endSec: parsed.data.endSec,
        fadeInSec: parsed.data.fadeInSec,
        fadeOutSec: parsed.data.fadeOutSec,
      })

      return reply.send({ ok: true as const, renderStatus: 'PROCESSING' as const })
    },
  )
}

export default adminAnnouncementsRoutes
