// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminListeningQuerySchema,
  AdminListeningResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { toShares } from '../../lib/listen-audience.js'
import { userName } from '../../lib/safe-names.js'

const TOP_CHANNELS = 10
const SESSION_LIMIT = 500_000

// Platform-wide listening for the board: how much people listen on Tahti,
// where, and which channels they spend the time with. Bots are left out.
const adminStatsListeningRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/stats/listening',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Platform listening: listens, minutes, signed-in listeners, share by surface and top channels by minutes',
        response: openApiResponse(AdminListeningResponseSchema, 'AdminListening'),
      },
    },
    async (request, reply) => {
      const parsed = AdminListeningQuerySchema.safeParse(request.query)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid range' })
      const { range } = parsed.data
      const since =
        range === 'all' ? undefined : new Date(Date.now() - Number(range) * 24 * 3600_000)
      const where = { isBot: false, ...(since ? { startedAt: { gte: since } } : {}) }

      const [rows, surfaceRows, signedIn] = await Promise.all([
        fastify.prisma.listenSession.findMany({
          where,
          select: { channelId: true, startedAt: true, lastSeenAt: true, maxPositionSec: true },
          take: SESSION_LIMIT,
        }),
        fastify.prisma.listenSession.groupBy({
          by: ['source'],
          where,
          _count: { _all: true },
        }),
        fastify.prisma.listenSession.findMany({
          where: { ...where, byUserId: { not: null } },
          distinct: ['byUserId'],
          select: { byUserId: true },
        }),
      ])

      const perChannel = new Map<string, { seconds: number; listens: number }>()
      let seconds = 0
      for (const row of rows) {
        const span = Math.max(0, (row.lastSeenAt.getTime() - row.startedAt.getTime()) / 1000)
        const s = Math.max(span, row.maxPositionSec ?? 0)
        seconds += s
        const entry = perChannel.get(row.channelId) ?? { seconds: 0, listens: 0 }
        entry.seconds += s
        entry.listens += 1
        perChannel.set(row.channelId, entry)
      }
      const top = [...perChannel].sort((a, b) => b[1].seconds - a[1].seconds).slice(0, TOP_CHANNELS)
      const channels = await fastify.prisma.channel.findMany({
        where: { id: { in: top.map(([id]) => id) } },
        select: { id: true, slug: true, user: { select: { username: true, displayName: true } } },
      })
      const channelById = new Map(channels.map((channel) => [channel.id, channel]))

      return reply.send({
        range,
        listens: rows.length,
        minutes: Math.round(seconds / 60),
        signedInListeners: signedIn.length,
        surfaces: toShares(
          surfaceRows.map((row) => ({ name: row.source, count: row._count._all })),
          1,
        ).items,
        topChannels: top.flatMap(([id, entry]) => {
          const channel = channelById.get(id)
          return channel
            ? [
                {
                  slug: channel.slug,
                  name: userName(channel.user),
                  minutes: Math.round(entry.seconds / 60),
                  listens: entry.listens,
                },
              ]
            : []
        }),
      })
    },
  )
}

export default adminStatsListeningRoutes
