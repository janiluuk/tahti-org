// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelMemberListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// GET /api/channels/:slug/members — public lineup/credits list for the artist page
const channelMembersRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/members',
    {
      schema: {
        tags: ['channel'],
        description: 'M36: public channel member/credits roster',
        response: openApiResponse(ChannelMemberListSchema, 'ChannelMemberList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const members = await fastify.prisma.channelMember.findMany({
        where: { channelId: channel.id },
        orderBy: { position: 'asc' },
      })
      return reply.send(members)
    },
  )
}

export default channelMembersRoute
