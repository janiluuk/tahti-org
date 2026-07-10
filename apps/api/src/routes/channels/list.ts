// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelListResponseSchema, openApiResponse, parseSocialLinksGenres } from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

const channelListRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/channels',
    {
      schema: {
        tags: ['channel'],
        description: 'Public channel directory — live now + recently active',
        response: openApiResponse(ChannelListResponseSchema, 'ChannelList'),
      },
    },
    async (_request, reply) => {
      const result = await getCachedJson('channels:list', 10, async () => {
        const [liveChannels, recentChannels] = await Promise.all([
          fastify.prisma.channel.findMany({
            where: { state: 'LIVE' },
            orderBy: { goneLiveAt: 'desc' },
            take: 20,
            select: {
              slug: true,
              state: true,
              goneLiveAt: true,
              nextBroadcastAt: true,
              nextBroadcastNote: true,
              user: {
                select: {
                  username: true,
                  displayName: true,
                  bio: true,
                  avatarUrl: true,
                  socialLinks: true,
                },
              },
            },
          }),
          fastify.prisma.channel.findMany({
            // Exact OFFLINE match, not just "not LIVE" — a channel mid-PREVIEW (testing,
            // not yet public) must not surface in the public "recently active" list.
            where: { state: 'OFFLINE', goneLiveAt: { not: null } },
            orderBy: { goneLiveAt: 'desc' },
            take: 20,
            select: {
              slug: true,
              state: true,
              goneLiveAt: true,
              nextBroadcastAt: true,
              nextBroadcastNote: true,
              user: {
                select: {
                  username: true,
                  displayName: true,
                  bio: true,
                  avatarUrl: true,
                  socialLinks: true,
                },
              },
            },
          }),
        ])

        const toCard = (ch: (typeof liveChannels)[0]) => ({
          ...ch,
          goneLiveAt: ch.goneLiveAt?.toISOString() ?? null,
          nextBroadcastAt: ch.nextBroadcastAt?.toISOString() ?? null,
          genres: parseSocialLinksGenres(ch.user.socialLinks),
        })

        return {
          live: liveChannels.map(toCard),
          recent: recentChannels.map(toCard),
        }
      })

      return reply.send(result)
    },
  )
}

export default channelListRoute
