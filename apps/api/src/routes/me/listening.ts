// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { MeListeningQuerySchema, MeListeningResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { trackArtistName, userName } from '../../lib/safe-names.js'

const TOP_LIMIT = 5
const SESSION_LIMIT = 50_000

function sessionSeconds(row: { startedAt: Date; lastSeenAt: Date; maxPositionSec: number | null }) {
  const span = Math.max(0, (row.lastSeenAt.getTime() - row.startedAt.getTime()) / 1000)
  return Math.max(span, row.maxPositionSec ?? 0)
}

function topBy<K>(totals: Map<K, number>, limit: number): [K, number][] {
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

// A signed-in listener's own listening across every device they use:
// minutes, listens and the artists and tracks they spent the most time with,
// from the listen sessions the player's heartbeat records.
const meListeningRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/listening',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description:
          "The caller's own minutes listened, listens and top artists / tracks by time, across devices",
        response: openApiResponse(MeListeningResponseSchema, 'MeListening'),
      },
    },
    async (request, reply) => {
      const parsed = MeListeningQuerySchema.safeParse(request.query)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid range' })
      const { range } = parsed.data
      const since =
        range === 'all' ? undefined : new Date(Date.now() - Number(range) * 24 * 3600_000)

      const rows = await fastify.prisma.listenSession.findMany({
        where: {
          byUserId: request.sessionUser!.id,
          ...(since ? { startedAt: { gte: since } } : {}),
        },
        select: {
          channelId: true,
          soundId: true,
          startedAt: true,
          lastSeenAt: true,
          maxPositionSec: true,
        },
        orderBy: { startedAt: 'desc' },
        take: SESSION_LIMIT,
      })

      const byChannel = new Map<string, number>()
      const bySound = new Map<string, number>()
      let seconds = 0
      for (const row of rows) {
        const s = sessionSeconds(row)
        seconds += s
        byChannel.set(row.channelId, (byChannel.get(row.channelId) ?? 0) + s)
        if (row.soundId) bySound.set(row.soundId, (bySound.get(row.soundId) ?? 0) + s)
      }

      const topChannels = topBy(byChannel, TOP_LIMIT)
      const topSounds = topBy(bySound, TOP_LIMIT)
      const [channels, sounds] = await Promise.all([
        fastify.prisma.channel.findMany({
          where: { id: { in: topChannels.map(([id]) => id) } },
          select: {
            id: true,
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
        fastify.prisma.sound.findMany({
          where: { id: { in: topSounds.map(([id]) => id) } },
          select: {
            id: true,
            title: true,
            artistName: true,
            channel: { select: { user: { select: { username: true, displayName: true } } } },
          },
        }),
      ])
      const channelById = new Map(channels.map((channel) => [channel.id, channel]))
      const soundById = new Map(sounds.map((sound) => [sound.id, sound]))

      return reply.send({
        range,
        minutes: Math.round(seconds / 60),
        listens: rows.length,
        topArtists: topChannels.flatMap(([id, s]) => {
          const channel = channelById.get(id)
          return channel
            ? [
                {
                  username: channel.user.username,
                  displayName: userName(channel.user),
                  avatarUrl: channel.user.avatarUrl,
                  minutes: Math.round(s / 60),
                },
              ]
            : []
        }),
        topTracks: topSounds.flatMap(([id, s]) => {
          const sound = soundById.get(id)
          return sound
            ? [
                {
                  soundId: sound.id,
                  title: sound.title,
                  artistName: trackArtistName(sound),
                  minutes: Math.round(s / 60),
                },
              ]
            : []
        }),
      })
    },
  )
}

export default meListeningRoutes
