// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  TrackPlaybackDetailsSchema,
  TrackReactionCreateSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { resolveChannelUrl } from '../../lib/channel-url.js'

interface TracklistEntry {
  startSec: number
  title: string
  artist?: string | null
}

function parseTracklist(raw: unknown): TracklistEntry[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter(
      (e): e is TracklistEntry => !!e && typeof e === 'object' && 'startSec' in e && 'title' in e,
    )
    .map((e) => ({
      startSec: Number(e.startSec),
      title: String(e.title),
      artist: e.artist ?? null,
    }))
}

// In-memory rate limit: max 20 reactions per user per 60s window
const reactionBucket = new Map<string, { count: number; reset: number }>()

function checkReactionLimit(userId: string): boolean {
  const now = Date.now()
  const entry = reactionBucket.get(userId)
  if (!entry || now > entry.reset) {
    reactionBucket.set(userId, { count: 1, reset: now + 60_000 })
    return true
  }
  if (entry.count >= 20) return false
  entry.count++
  return true
}

const pruneTimer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of reactionBucket) {
    if (now > v.reset) reactionBucket.delete(k)
  }
}, 60_000)
pruneTimer.unref()

async function publishLovedMessage(params: {
  slug: string
  actorDisplayName: string
  trackTitle: string
  trackId: string
}) {
  const { slug, actorDisplayName, trackTitle, trackId } = params
  await fetch(`${config.centrifugo.apiUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `apikey ${config.centrifugo.apiKey}`,
    },
    body: JSON.stringify({
      method: 'publish',
      params: {
        channel: `channel:${slug}`,
        data: {
          handle: 'Tahti',
          text: `${actorDisplayName} loved ${trackTitle}`,
          system: true,
          href: resolveChannelUrl(slug, { hash: `archive-item-${trackId}` }),
          ts: Date.now(),
        },
      },
    }),
  })
}

const trackReactionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/reactions/track/:id — waveform peaks, reaction markers, and the
  // identity/tracklist info the full player's fullscreen mode shows.
  fastify.get(
    '/api/reactions/track/:id',
    { schema: { response: openApiResponse(TrackPlaybackDetailsSchema, 'TrackPlaybackDetails') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id: routeParams.id },
        select: {
          id: true,
          title: true,
          artistName: true,
          peaks: true,
          tracklist: true,
          isPublic: true,
          channel: {
            select: { slug: true, user: { select: { displayName: true, avatarUrl: true } } },
          },
        },
      })
      if (!item || !item.isPublic) return reply.status(404).send({ error: 'Track not found' })

      const reactions = await fastify.prisma.trackReaction.findMany({
        where: { archiveItemId: routeParams.id },
        orderBy: { createdAt: 'asc' },
        take: 500,
        select: { id: true, type: true, positionSec: true, createdAt: true },
      })

      return reply.send({
        title: item.title,
        artistName: item.artistName ?? item.channel.user.displayName,
        artistAvatarUrl: item.channel.user.avatarUrl,
        channelSlug: item.channel.slug,
        tracklist: parseTracklist(item.tracklist),
        peaks: (item.peaks as number[] | null) ?? null,
        reactions,
      })
    },
  )

  // POST /api/reactions/track/:id { type, positionSec }
  fastify.post('/api/reactions/track/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const parsed = TrackReactionCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
    }

    const user = request.sessionUser!
    if (!checkReactionLimit(user.id)) {
      return reply.status(429).send({ error: 'Slow down' })
    }

    const item = await fastify.prisma.archiveItem.findUnique({
      where: { id: routeParams.id },
      select: {
        id: true,
        title: true,
        isPublic: true,
        durationSec: true,
        channel: { select: { slug: true } },
      },
    })
    if (!item || !item.isPublic) return reply.status(404).send({ error: 'Track not found' })

    const positionSec = item.durationSec
      ? Math.min(parsed.data.positionSec, item.durationSec)
      : parsed.data.positionSec

    const reaction = await fastify.prisma.trackReaction.create({
      data: {
        archiveItemId: item.id,
        userId: user.id,
        type: parsed.data.type,
        positionSec,
      },
      select: { id: true, type: true, positionSec: true, createdAt: true },
    })

    if (parsed.data.type === 'LOVE') {
      publishLovedMessage({
        slug: item.channel.slug,
        actorDisplayName: user.displayName,
        trackTitle: item.title,
        trackId: item.id,
      }).catch((err: unknown) => fastify.log.warn({ err }, 'centrifugo publish failed'))
    }

    return reply.status(201).send(reaction)
  })
}

export default trackReactionsRoutes
