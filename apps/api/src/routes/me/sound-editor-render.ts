// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { validateEditList } from '@tahti/audio-edit'
import {
  SOUND_CLIP_MAX_DURATION_SEC,
  SoundEditListRenderResponseSchema,
  SoundEditListRenderSchema,
  SoundEditorCreateClipResponseSchema,
  SoundEditorCreateClipSchema,
  IdParamSchema,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { resolveSoundEditorSource } from '../../lib/sound-editor-source.js'
import { enqueueRenderAnnouncementTrim, enqueueRenderSoundEdit } from '../../lib/queue.js'
import { ensureInitialVersion } from '@tahti/db'
import {
  countActiveEditorJobs,
  MAX_CONCURRENT_EDITOR_JOBS,
  ownedItem,
} from './sound-editor-helpers.js'

const meSoundEditorRenderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/sound/:id/editor/bounce',
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
      reply.header('Link', '</api/me/sound/{id}/editor/render>; rel="successor-version"')
      request.log.warn('Removed editor/bounce — clients must use editor/render with EditList')
      return reply.status(410).send({
        error:
          'POST …/editor/bounce is removed. Use POST …/editor/render with EditList (v0 trim: editListFromV0Trim in @tahti/audio-edit).',
      })
    },
  )

  fastify.post(
    '/api/me/sound/:id/editor/render',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: server-side render of EditList via native ffmpeg (Render B)',
        response: openApiResponses([
          {
            status: 202,
            schema: SoundEditListRenderResponseSchema,
            name: 'SoundEditListRender',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = SoundEditListRenderSchema.safeParse(request.body)
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

      const item = await ownedItem(fastify, user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const source = await resolveSoundEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Sound item is not ready for editing' })
      }

      const { versionLabel, activate, format, maxDurationSec, sampleOnly } = parsed.data
      const editList = validation.edit

      if ((await countActiveEditorJobs(fastify, user.id)) >= MAX_CONCURRENT_EDITOR_JOBS) {
        return reply.status(429).send({ error: 'Too many editor renders in progress (max 2)' })
      }

      await ensureInitialVersion(fastify.prisma, id)
      const versionCount = await fastify.prisma.soundVersion.count({
        where: { soundId: id },
      })

      const version = await fastify.prisma.soundVersion.create({
        data: {
          soundId: id,
          versionNumber: versionCount + 1,
          versionLabel,
          rawKey: `pending/${item.channel.slug}/${id}`,
          fileSizeBytes: 0,
          status: 'PENDING',
          isActive: false,
        },
        select: { id: true, versionNumber: true, status: true },
      })

      await enqueueRenderSoundEdit({
        versionId: version.id,
        soundId: id,
        channelSlug: item.channel.slug,
        sourceKey: source.sourceKey,
        editList,
        format,
        activate,
        maxDurationSec,
        sampleOnly,
      })

      await auditLog(fastify.prisma, {
        action: 'SOUND_EDIT_RENDER',
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

  // Create a ≤60s announcement/station-ID clip from an in/out selection on this track.
  fastify.post(
    '/api/me/sound/:id/editor/create-clip',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Cut a short announcement clip (max 60s) from an sound track for radio station IDs',
        response: openApiResponses([
          {
            status: 202,
            schema: SoundEditorCreateClipResponseSchema,
            name: 'SoundEditorCreateClip',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = SoundEditorCreateClipSchema.safeParse(request.body)
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

      const source = await resolveSoundEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Sound item is not ready for editing' })
      }

      const { startSec, endSec, fadeInSec, fadeOutSec } = parsed.data
      if (source.durationSec != null && endSec > source.durationSec + 0.05) {
        return reply.status(400).send({ error: 'End is past the end of the track' })
      }

      const durationSec = Math.round((endSec - startSec) * 1000) / 1000
      if (durationSec > SOUND_CLIP_MAX_DURATION_SEC) {
        return reply
          .status(400)
          .send({ error: `Clip must be ${SOUND_CLIP_MAX_DURATION_SEC} seconds or less` })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const maxPos = await fastify.prisma.announcementClip.aggregate({
        where: { channelId: channel.id },
        _max: { position: true },
      })
      const title =
        parsed.data.title?.trim() ||
        `${item.title.slice(0, 100)}${item.title.length > 100 ? '…' : ''} (clip)`

      // originalAudioKey points at the sound source so re-trims never compound.
      // audioKey is a pending placeholder until the trim worker writes the MP3.
      const clip = await fastify.prisma.announcementClip.create({
        data: {
          channelId: channel.id,
          title,
          audioKey: `announcements/own/${channel.slug}/pending-${id}`,
          originalAudioKey: source.sourceKey,
          durationSec: Math.round(durationSec),
          position: (maxPos._max.position ?? -1) + 1,
          renderStatus: 'PROCESSING',
          isEnabled: false,
        },
        select: { id: true, title: true, durationSec: true, renderStatus: true },
      })

      await enqueueRenderAnnouncementTrim({
        clipId: clip.id,
        sourceKey: source.sourceKey,
        outputKeyPrefix: `announcements/own/${channel.slug}`,
        startSec,
        endSec,
        fadeInSec,
        fadeOutSec,
      })

      await auditLog(fastify.prisma, {
        action: 'SOUND_EDIT_RENDER',
        actorId: user.id,
        targetId: id,
        meta: {
          kind: 'create-clip',
          clipId: clip.id,
          startSec,
          endSec,
          durationSec,
        },
      })

      return reply.status(202).send({
        ok: true as const,
        clipId: clip.id,
        title: clip.title,
        durationSec: clip.durationSec ?? Math.round(durationSec),
        renderStatus: clip.renderStatus,
      })
    },
  )
}

export default meSoundEditorRenderRoutes
