// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelDirectoryResponseSchema,
  openApiResponse,
  parseSocialLinksGenres,
} from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

const channelDirectoryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/channels/directory',
    {
      schema: {
        tags: ['channel'],
        description: 'Discover → Artists tab: every channel with a public archive item',
        response: openApiResponse(ChannelDirectoryResponseSchema, 'ChannelDirectory'),
      },
    },
    async (_request, reply) => {
      const result = await getCachedJson('channels:directory', 60, async () => {
        const channels = await fastify.prisma.channel.findMany({
          where: { archiveItems: { some: { status: 'READY', isPublic: true } } },
          orderBy: { user: { displayName: 'asc' } },
          take: 500,
          select: {
            slug: true,
            user: { select: { displayName: true, avatarUrl: true, socialLinks: true } },
          },
        })

        return {
          items: channels.map((ch) => ({
            slug: ch.slug,
            displayName: ch.user.displayName,
            avatarUrl: ch.user.avatarUrl,
            genres: parseSocialLinksGenres(ch.user.socialLinks),
          })),
        }
      })

      return reply.send(result)
    },
  )
}

export default channelDirectoryRoute
