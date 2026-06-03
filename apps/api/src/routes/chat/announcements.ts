// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatAnnouncementListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// Public: GET announcements for a channel
const chatAnnouncementsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/chat/:slug/announcements',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatAnnouncementListSchema, 'ChatAnnouncementList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const announcements = await fastify.prisma.channelAnnouncement.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, body: true, createdAt: true },
      })

      return reply.send(announcements)
    },
  )
}

export default chatAnnouncementsRoute
