// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminContentStatsSchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const LATEST_LIMIT = 10

const artistNameOf = (user: { displayName: string; username: string }) =>
  user.displayName.trim() || user.username

/** Catalog counters and the newest uploads and finished broadcasts, read
 * by Tahti Player's /admin/content view. */
const adminContentStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/stats/content',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Track/show/upload/listen counts plus latest uploads and broadcasts',
        response: openApiResponse(AdminContentStatsSchema, 'AdminContentStats'),
      },
    },
    async (_request, reply) => {
      const channelUser = { select: { user: { select: { displayName: true, username: true } } } }
      const [tracks, shows, uploads, listens, latestSounds, latestBroadcasts] = await Promise.all([
        fastify.prisma.sound.count({ where: { contentType: 'TRACK' } }),
        fastify.prisma.liveShowSeries.count(),
        fastify.prisma.sound.count(),
        fastify.prisma.listenEvent.count(),
        fastify.prisma.sound.findMany({
          orderBy: { createdAt: 'desc' },
          take: LATEST_LIMIT,
          select: {
            id: true,
            title: true,
            contentType: true,
            createdAt: true,
            channel: channelUser,
          },
        }),
        fastify.prisma.broadcast.findMany({
          where: { endedAt: { not: null }, wentLiveAt: { not: null } },
          orderBy: { startedAt: 'desc' },
          take: LATEST_LIMIT,
          select: {
            id: true,
            title: true,
            startedAt: true,
            endedAt: true,
            soundId: true,
            channel: { select: { slug: true, ...channelUser.select } },
          },
        }),
      ])

      return reply.send({
        counts: { tracks, shows, uploads, listens },
        latestContent: latestSounds.map((sound) => ({
          id: sound.id,
          title: sound.title,
          type: sound.contentType,
          artistName: sound.channel ? artistNameOf(sound.channel.user) : null,
          createdAt: sound.createdAt.toISOString(),
        })),
        latestBroadcasts: latestBroadcasts.map((broadcast) => ({
          id: broadcast.id,
          title: broadcast.title?.trim() || broadcast.channel.slug,
          artistName: artistNameOf(broadcast.channel.user),
          recordedAt: broadcast.startedAt.toISOString(),
          durationSec: broadcast.endedAt
            ? Math.max(
                0,
                Math.round((broadcast.endedAt.getTime() - broadcast.startedAt.getTime()) / 1000),
              )
            : null,
          soundId: broadcast.soundId,
        })),
      })
    },
  )
}

export default adminContentStatsRoutes
