// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  SoundListSchema,
  SoundListQuerySchema,
  SoundRecentSchema,
  SoundViewSchema,
  IdParamSchema,
  ReorderSoundsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyFollowersOfNewTrack } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import {
  soundMetadataSelect,
  metadataPatchFromBody,
  serializeSound,
} from '../../lib/sound-metadata.js'
import { normalizeTracklist, recordTracklistMentions } from '../../lib/tracklist.js'
import {
  MAX_FALLBACK_ITEMS,
  fallbackCount,
  oldestFallbackItem,
} from '../../lib/fallback-rotation.js'
import type { TracklistEntry } from '@tahti/shared'
import { SOUND_LIST_ORDER_BY } from './sound-helpers.js'

const meSoundCrudRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/sound',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: list channel sound items with metadata',
        response: openApiResponse(SoundListSchema, 'SoundList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = SoundListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.sound.findMany({
        where: { channelId: channel.id },
        orderBy: SOUND_LIST_ORDER_BY[parsedQuery.data.sort ?? 'newest'],
        take: 100,
        select: soundMetadataSelect,
      })
      return reply.send(items.map((i) => serializeSound(i)))
    },
  )

  // PERF-006: slim variant for the dashboard overview, which only ever shows the
  // 1-2 most recent items — avoids the full-metadata select GET /api/me/sound does.
  fastify.get(
    '/api/me/sound/recent',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PERF-006: slim recent-items list for the dashboard overview',
        response: openApiResponse(SoundRecentSchema, 'SoundRecent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.sound.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, title: true, durationSec: true, createdAt: true },
      })
      return reply.send(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })))
    },
  )

  fastify.get(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(SoundViewSchema, 'Sound'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: soundMetadataSelect,
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      return reply.send(serializeSound(item))
    },
  )

  fastify.patch(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: patch sound item metadata (SoundMetadataPatchSchema body)',
        response: openApiResponse(SoundViewSchema, 'Sound'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true, channelId: true, isFallback: true, isPublic: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

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
          const replaceTarget = await fastify.prisma.sound.findFirst({
            where: { id: replaceId, channelId: item.channelId, isFallback: true },
            select: { id: true },
          })
          if (!replaceTarget) {
            return reply.status(400).send({ error: 'replaceFallbackItemId is not in rotation' })
          }
          await fastify.prisma.sound.update({
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

      const updated = await fastify.prisma.sound.update({
        where: { id },
        data: patch.data,
        select: soundMetadataSelect,
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

      return reply.send(serializeSound(updated))
    },
  )

  fastify.delete(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Delete an sound item and its versions/rotation entries',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      try {
        await fastify.prisma.sound.delete({ where: { id } })
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

  // PUT /api/me/sound/reorder — persist manual order for the public "Tracks" tab
  fastify.put('/api/me/sound/reorder', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ReorderSoundsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const { ids } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

    const owned = await fastify.prisma.sound.findMany({
      where: { id: { in: ids }, channelId: channel.id },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((i) => i.id))

    await fastify.prisma.$transaction(
      ids
        .filter((id) => ownedIds.has(id))
        .map((id, order) =>
          fastify.prisma.sound.update({ where: { id }, data: { trackOrder: order } }),
        ),
    )

    return reply.status(204).send()
  })
}

export default meSoundCrudRoutes
