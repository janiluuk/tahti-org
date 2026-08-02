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
  CompleteAnnouncementUploadSchema,
  IdParamSchema,
  PatchAnnouncementClipSchema,
  PrepareAnnouncementUploadResponseSchema,
  PrepareAnnouncementUploadSchema,
  ProfileBackgroundClipResponseSchema,
  ProfileBackgroundClipSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
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

type ClipRow = {
  id: string
  title: string
  durationSec: number | null
  isEnabled: boolean
  scheduleMode: 'AFTER_EVERY' | 'EVERY_NTH' | 'RANDOM'
  everyNth: number | null
  position: number
  renderStatus: 'READY' | 'PROCESSING' | 'ERROR'
  createdAt: Date
}

function withProfileFlag(clip: ClipRow, profileBackgroundClipId: string | null) {
  return {
    ...clip,
    isProfileBackground: profileBackgroundClipId === clip.id,
  }
}

const meAnnouncementsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/announcements/prepare — presigned upload for one's own announcement library
  fastify.post(
    '/api/me/announcements/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
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

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { slug: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const ext = filename.includes('.') ? filename.split('.').pop() : 'mp3'
      const uploadId = `announcements/own/${channel.slug}/${nanoid(16)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadId, contentType, PRESIGN_TTL_SEC, fileSizeBytes)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadId, uploadUrl, expiresAt })
    },
  )

  // POST /api/me/announcements/complete
  fastify.post(
    '/api/me/announcements/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
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

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true, slug: true, profileBackgroundClipId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!uploadId.startsWith(`announcements/own/${channel.slug}/`)) {
        return reply.status(403).send({ error: 'Upload does not belong to your channel' })
      }

      const clip = await fastify.prisma.announcementClip.create({
        data: {
          channelId: channel.id,
          title,
          audioKey: uploadId,
          originalAudioKey: uploadId,
          durationSec,
        },
        select: CLIP_SELECT,
      })
      return reply.status(201).send(withProfileFlag(clip, channel.profileBackgroundClipId))
    },
  )

  // GET /api/me/announcements
  fastify.get(
    '/api/me/announcements',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AnnouncementClipListSchema, 'AnnouncementClipList'),
      },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true, profileBackgroundClipId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const clips = await fastify.prisma.announcementClip.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        select: CLIP_SELECT,
      })
      return reply.send({
        clips: clips.map((c) => withProfileFlag(c, channel.profileBackgroundClipId)),
      })
    },
  )

  // PATCH /api/me/channel/profile-background — assign (or clear) page ambient music clip
  fastify.patch(
    '/api/me/channel/profile-background',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Assign an announcement clip as looping music on the public artist page',
        response: openApiResponse(ProfileBackgroundClipResponseSchema, 'ProfileBackgroundClip'),
      },
    },
    async (request, reply) => {
      const parsed = ProfileBackgroundClipSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { clipId } = parsed.data
      if (clipId) {
        const clip = await fastify.prisma.announcementClip.findFirst({
          where: { id: clipId, channelId: channel.id },
          select: { id: true, renderStatus: true, audioKey: true },
        })
        if (!clip) return reply.status(404).send({ error: 'Clip not found' })
        if (clip.renderStatus !== 'READY' || clip.audioKey.includes('/pending-')) {
          return reply.status(409).send({ error: 'Clip is still processing — try again shortly' })
        }
      }

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { profileBackgroundClipId: clipId },
      })
      return reply.send({ clipId })
    },
  )

  // PATCH /api/me/announcements/:id — title/isEnabled only; scheduling is
  // system-clip-only (see routes/admin/announcements.ts), so those fields
  // are silently ignored here rather than rejected.
  fastify.patch(
    '/api/me/announcements/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchAnnouncementClipSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true, profileBackgroundClipId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const existing = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Announcement not found' })

      const clip = await fastify.prisma.announcementClip.update({
        where: { id: routeParams.id },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.isEnabled !== undefined ? { isEnabled: parsed.data.isEnabled } : {}),
        },
        select: CLIP_SELECT,
      })
      return reply.send(withProfileFlag(clip, channel.profileBackgroundClipId))
    },
  )

  // DELETE /api/me/announcements/:id
  fastify.delete(
    '/api/me/announcements/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { count } = await fastify.prisma.announcementClip.deleteMany({
        where: { id: routeParams.id, channelId: channel.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Announcement not found' })
      return reply.status(204).send()
    },
  )

  // GET /api/me/announcements/:id/editor/source — presigned URLs for both the
  // current (possibly already-trimmed) clip and the untouched original, so the
  // editor can offer an A/B preview.
  fastify.get(
    '/api/me/announcements/:id/editor/source',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AnnouncementEditorSourceSchema, 'AnnouncementEditorSource'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const clip = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
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

  // POST /api/me/announcements/:id/editor/render — enqueue a trim+fade render,
  // always sourced from originalAudioKey (never from a previous trim's output).
  fastify.post(
    '/api/me/announcements/:id/editor/render',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
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

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true, slug: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const clip = await fastify.prisma.announcementClip.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
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
        outputKeyPrefix: `announcements/own/${channel.slug}`,
        startSec: parsed.data.startSec,
        endSec: parsed.data.endSec,
        fadeInSec: parsed.data.fadeInSec,
        fadeOutSec: parsed.data.fadeOutSec,
      })

      return reply.send({ ok: true as const, renderStatus: 'PROCESSING' as const })
    },
  )
}

export default meAnnouncementsRoutes
