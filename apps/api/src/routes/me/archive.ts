// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  ChannelGalleryPatchSchema,
  ChannelStreamOverlayPatchSchema,
  ChannelTextLayerPatchSchema,
  ChannelVisualPatchSchema,
  ArchiveItemVisualPatchSchema,
  ArchiveItemListSchema,
  ArchiveItemRecentSchema,
  ArchiveItemViewSchema,
  IdParamSchema,
  ReorderArchiveItemsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { getUserIntegrationCredential, notifyFollowersOfNewTrack } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import {
  archiveItemMetadataSelect,
  metadataPatchFromBody,
  serializeArchiveItem,
} from '../../lib/archive-metadata.js'
import { normalizeTracklist, recordTracklistMentions } from '../../lib/tracklist.js'
import { enqueueHearthisExport } from '../../lib/queue.js'
import {
  MAX_FALLBACK_ITEMS,
  fallbackCount,
  oldestFallbackItem,
} from '../../lib/fallback-rotation.js'
import type { TracklistEntry } from '@tahti/shared'

const meArchiveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/archive',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: list channel archive items with metadata',
        response: openApiResponse(ArchiveItemListSchema, 'ArchiveItemList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: archiveItemMetadataSelect,
      })
      return reply.send(items.map((i) => serializeArchiveItem(i)))
    },
  )

  // PERF-006: slim variant for the dashboard overview, which only ever shows the
  // 1-2 most recent items — avoids the full-metadata select GET /api/me/archive does.
  fastify.get(
    '/api/me/archive/recent',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PERF-006: slim recent-items list for the dashboard overview',
        response: openApiResponse(ArchiveItemRecentSchema, 'ArchiveItemRecent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, title: true, durationSec: true, createdAt: true },
      })
      return reply.send(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })))
    },
  )

  fastify.get(
    '/api/me/archive/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArchiveItemViewSchema, 'ArchiveItem'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id, channel: { userId: user.id } },
        select: archiveItemMetadataSelect,
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      return reply.send(serializeArchiveItem(item))
    },
  )

  fastify.patch(
    '/api/me/archive/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: patch archive item metadata (ArchiveMetadataPatchSchema body)',
        response: openApiResponse(ArchiveItemViewSchema, 'ArchiveItem'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true, channelId: true, isFallback: true, isPublic: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const patch = metadataPatchFromBody(request.body)
      if (!patch.ok) return reply.status(400).send({ error: patch.error })

      if (patch.title !== undefined) {
        const t = patch.title.trim()
        if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
        patch.data.title = t.slice(0, 200)
      }

      // Joining the 24/7 rotation is capped — past MAX_FALLBACK_ITEMS the caller
      // must confirm which existing track to evict (replaceFallbackItemId), since
      // there's no list UI at this call site to pick from directly.
      if (patch.data.isFallback === true && !item.isFallback) {
        const count = await fallbackCount(fastify.prisma, item.channelId)
        if (count >= MAX_FALLBACK_ITEMS) {
          const body = request.body as { replaceFallbackItemId?: string }
          const replaceId = body.replaceFallbackItemId
          if (!replaceId) {
            const oldest = await oldestFallbackItem(fastify.prisma, item.channelId)
            return reply.status(409).send({
              error: `Rotation is full (max ${MAX_FALLBACK_ITEMS}) — choose a track to replace`,
              oldestItem: oldest,
            })
          }
          const replaceTarget = await fastify.prisma.archiveItem.findFirst({
            where: { id: replaceId, channelId: item.channelId, isFallback: true },
            select: { id: true },
          })
          if (!replaceTarget) {
            return reply.status(400).send({ error: 'replaceFallbackItemId is not in rotation' })
          }
          await fastify.prisma.archiveItem.update({
            where: { id: replaceTarget.id },
            data: { isFallback: false },
          })
        }
      }

      if (patch.data.tracklist !== undefined && patch.data.tracklist !== null) {
        try {
          patch.data.tracklist = await normalizeTracklist(
            fastify.prisma,
            patch.data.tracklist as TracklistEntry[],
          )
        } catch (err) {
          return reply
            .status(400)
            .send({ error: err instanceof Error ? err.message : 'Invalid tracklist' })
        }
      }

      const updated = await fastify.prisma.archiveItem.update({
        where: { id },
        data: patch.data,
        select: archiveItemMetadataSelect,
      })

      // Fan out to followers exactly once, the moment a track first goes public —
      // not on every subsequent metadata edit.
      if (patch.data.isPublic === true && !item.isPublic) {
        await notifyFollowersOfNewTrack(fastify.prisma, user, updated).catch((e) =>
          fastify.log.warn(e, 'new-track notification failed'),
        )
      }

      if (patch.data.tracklist !== undefined && Array.isArray(updated.tracklist)) {
        try {
          await recordTracklistMentions(
            fastify.prisma,
            user.id,
            updated.tracklist as TracklistEntry[],
            id,
          )
        } catch (e) {
          fastify.log.warn(e, 'tracklist mention record failed')
        }
      }

      return reply.send(serializeArchiveItem(updated))
    },
  )

  fastify.delete(
    '/api/me/archive/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Delete an archive item and its versions/rotation entries',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      try {
        await fastify.prisma.archiveItem.delete({ where: { id } })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          return reply.status(409).send({
            error: 'This item has a linked Mixcloud upload — disconnect that first, then delete.',
          })
        }
        throw err
      }

      return reply.status(204).send()
    },
  )

  // PUT /api/me/archive/reorder — persist manual order for the public "Tracks" tab
  fastify.put('/api/me/archive/reorder', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ReorderArchiveItemsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const { ids } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

    const owned = await fastify.prisma.archiveItem.findMany({
      where: { id: { in: ids }, channelId: channel.id },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((i) => i.id))

    await fastify.prisma.$transaction(
      ids
        .filter((id) => ownedIds.has(id))
        .map((id, order) =>
          fastify.prisma.archiveItem.update({ where: { id }, data: { trackOrder: order } }),
        ),
    )

    return reply.status(204).send()
  })

  fastify.get('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  async function patchChannelGallery(
    userId: string,
    body: unknown,
  ): Promise<
    | {
        ok: true
        galleryMode: string
        slideshowImages: string[]
        videoBackgroundUrl: string | null
      }
    | { ok: false; status: number; error: string }
  > {
    const parsed = ChannelGalleryPatchSchema.safeParse(body)
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid body' }
    }
    if (
      parsed.data.galleryMode === undefined &&
      parsed.data.slideshowImages === undefined &&
      parsed.data.videoBackgroundUrl === undefined
    ) {
      return {
        ok: false,
        status: 400,
        error: 'galleryMode, slideshowImages, or videoBackgroundUrl required',
      }
    }

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!channel) return { ok: false, status: 404, error: 'Channel not found' }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(parsed.data.galleryMode !== undefined ? { galleryMode: parsed.data.galleryMode } : {}),
        ...(parsed.data.slideshowImages !== undefined
          ? { slideshowImages: parsed.data.slideshowImages }
          : {}),
        ...(parsed.data.videoBackgroundUrl !== undefined
          ? { videoBackgroundUrl: parsed.data.videoBackgroundUrl }
          : {}),
      },
      select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
    })

    return { ok: true, ...updated }
  }

  fastify.patch('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const result = await patchChannelGallery(request.sessionUser!.id, request.body)
    if (!result.ok) return reply.status(result.status).send({ error: result.error })
    return reply.send({
      galleryMode: result.galleryMode,
      slideshowImages: result.slideshowImages,
      videoBackgroundUrl: result.videoBackgroundUrl,
    })
  })

  fastify.patch(
    '/api/me/channel/slideshow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const result = await patchChannelGallery(request.sessionUser!.id, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ slideshowImages: result.slideshowImages })
    },
  )

  fastify.get('/api/me/channel/text-layer', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  async function patchChannelTextLayer(
    userId: string,
    body: unknown,
  ): Promise<
    | { ok: true; textLayerMode: string; textLayerText: string; textLayerAlign: string }
    | { ok: false; status: number; error: string }
  > {
    const parsed = ChannelTextLayerPatchSchema.safeParse(body)
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid body' }
    }
    if (
      parsed.data.textLayerMode === undefined &&
      parsed.data.textLayerText === undefined &&
      parsed.data.textLayerAlign === undefined
    ) {
      return {
        ok: false,
        status: 400,
        error: 'textLayerMode, textLayerText, or textLayerAlign required',
      }
    }

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!channel) return { ok: false, status: 404, error: 'Channel not found' }

    const nextMode = parsed.data.textLayerMode ?? channel.textLayerMode
    const nextText =
      parsed.data.textLayerText !== undefined ? parsed.data.textLayerText : channel.textLayerText
    if (nextMode !== 'NONE' && nextText.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        error: 'textLayerText is required when a text effect is enabled',
      }
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(parsed.data.textLayerMode !== undefined
          ? { textLayerMode: parsed.data.textLayerMode }
          : {}),
        ...(parsed.data.textLayerText !== undefined
          ? { textLayerText: parsed.data.textLayerText }
          : {}),
        ...(parsed.data.textLayerAlign !== undefined
          ? { textLayerAlign: parsed.data.textLayerAlign }
          : {}),
      },
      select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })

    return { ok: true, ...updated }
  }

  fastify.patch(
    '/api/me/channel/text-layer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const result = await patchChannelTextLayer(request.sessionUser!.id, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({
        textLayerMode: result.textLayerMode,
        textLayerText: result.textLayerText,
        textLayerAlign: result.textLayerAlign,
      })
    },
  )

  // M31: PLAT-071/073/075 — channel visual preset + color scheme + slideshow preset
  fastify.get('/api/me/channel/visual', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: {
        colorSchemeJson: true,
        visualPreset: true,
        visualSettingsJson: true,
        headerStyle: true,
        videoBackgroundUrl: true,
        brandAccentPreset: true,
        slideshowPreset: true,
        slideshowIntervalSeconds: true,
        slideshowTransitionMs: true,
        slideshowAutoplay: true,
      },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  fastify.patch('/api/me/channel/visual', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ChannelVisualPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const {
      visualPreset,
      colorScheme,
      visualSettings,
      headerStyle,
      videoBackgroundUrl,
      brandAccentPreset,
      slideshowPreset,
      slideshowIntervalSeconds,
      slideshowTransitionMs,
      slideshowAutoplay,
    } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true, headerStyle: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    // Gate on the header style this patch will leave in effect, not just one
    // this specific call happens to set — otherwise a FREE-tier channel that
    // somehow already has VIDEO_LOOP could keep updating its clip URL forever
    // without ever re-tripping the paid-tier check.
    const effectiveHeaderStyle = headerStyle ?? channel.headerStyle
    if (effectiveHeaderStyle === 'VIDEO_LOOP' && user.tier === 'FREE') {
      return reply
        .status(403)
        .send({ error: 'Video loop header is a paid-tier feature — upgrade to use it' })
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(visualPreset !== undefined ? { visualPreset } : {}),
        ...(colorScheme !== undefined
          ? { colorSchemeJson: colorScheme ? JSON.stringify(colorScheme) : null }
          : {}),
        ...(visualSettings !== undefined
          ? {
              visualSettingsJson:
                visualSettings && Object.keys(visualSettings).length > 0
                  ? JSON.stringify(visualSettings)
                  : null,
            }
          : {}),
        ...(headerStyle !== undefined ? { headerStyle } : {}),
        ...(videoBackgroundUrl !== undefined
          ? { videoBackgroundUrl: videoBackgroundUrl || null }
          : {}),
        ...(brandAccentPreset !== undefined ? { brandAccentPreset } : {}),
        ...(slideshowPreset !== undefined ? { slideshowPreset } : {}),
        ...(slideshowIntervalSeconds !== undefined ? { slideshowIntervalSeconds } : {}),
        ...(slideshowTransitionMs !== undefined ? { slideshowTransitionMs } : {}),
        ...(slideshowAutoplay !== undefined ? { slideshowAutoplay } : {}),
      },
      select: {
        colorSchemeJson: true,
        visualPreset: true,
        visualSettingsJson: true,
        headerStyle: true,
        videoBackgroundUrl: true,
        brandAccentPreset: true,
        slideshowPreset: true,
        slideshowIntervalSeconds: true,
        slideshowTransitionMs: true,
        slideshowAutoplay: true,
      },
    })
    return reply.send(updated)
  })

  // Multistream video overlay — title/subtitle/cover baked into the RTMP
  // mirror pushes' video track (see buildRtmpMirrorOutput). Shared across all
  // of a channel's targets; falls back to display name + avatar when unset.
  fastify.get(
    '/api/me/channel/stream-overlay',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: {
          streamOverlayTitle: true,
          streamOverlaySubtitle: true,
          streamOverlayCoverUrl: true,
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  fastify.patch(
    '/api/me/channel/stream-overlay',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelStreamOverlayPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { streamOverlayTitle, streamOverlaySubtitle, streamOverlayCoverUrl } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: {
          ...(streamOverlayTitle !== undefined
            ? { streamOverlayTitle: streamOverlayTitle || null }
            : {}),
          ...(streamOverlaySubtitle !== undefined
            ? { streamOverlaySubtitle: streamOverlaySubtitle || null }
            : {}),
          ...(streamOverlayCoverUrl !== undefined
            ? { streamOverlayCoverUrl: streamOverlayCoverUrl || null }
            : {}),
        },
        select: {
          streamOverlayTitle: true,
          streamOverlaySubtitle: true,
          streamOverlayCoverUrl: true,
        },
      })
      return reply.send(updated)
    },
  )

  // M31: PLAT-074 — archive item visual preset
  fastify.patch(
    '/api/me/archive/:id/visual',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = ArchiveItemVisualPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: routeParams.id, channel: { userId: user.id } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const updated = await fastify.prisma.archiveItem.update({
        where: { id: item.id },
        data: {
          ...(parsed.data.visualPreset !== undefined
            ? { visualPreset: parsed.data.visualPreset }
            : {}),
          ...(parsed.data.colorScheme !== undefined
            ? {
                colorSchemeJson: parsed.data.colorScheme
                  ? JSON.stringify(parsed.data.colorScheme)
                  : null,
              }
            : {}),
        },
        select: { visualPreset: true, colorSchemeJson: true },
      })
      return reply.send(updated)
    },
  )

  // POST /api/me/archive/:id/export/hearthis — push this track out to the
  // caller's own hearthis.at account, via their installed hearthis-export credential.
  fastify.post(
    '/api/me/archive/:id/export/hearthis',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const credential = await getUserIntegrationCredential(
        fastify.prisma,
        user.id,
        'hearthis-export',
      )
      if (!credential) {
        return reply.status(400).send({ error: 'Install the hearthis.at export plugin first' })
      }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: routeParams.id, channel: { userId: user.id } },
        select: { id: true, hearthisExportStatus: true, rawKey: true, mp3Key: true, flacKey: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (!item.rawKey && !item.mp3Key && !item.flacKey) {
        return reply.status(400).send({ error: 'This track has no audio file to export' })
      }
      if (item.hearthisExportStatus === 'pending' || item.hearthisExportStatus === 'submitted') {
        return reply.status(409).send({ error: 'Export already in progress' })
      }

      await fastify.prisma.archiveItem.update({
        where: { id: item.id },
        data: { hearthisExportStatus: 'pending' },
      })
      await enqueueHearthisExport(item.id)

      return reply.status(202).send({ archiveItemId: item.id, hearthisExportStatus: 'pending' })
    },
  )
}

export default meArchiveRoutes
