// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicMentionListSchema,
  UsernameParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// M15 — public mention feed (opt-in via publicMentionsEnabled)
const publicMentionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/u/:username/mentions',
    {
      schema: {
        tags: ['mentions'],
        description: 'M15: public mentions for artists who opted in',
        response: openApiResponse(PublicMentionListSchema, 'PublicMentionList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const user = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true, publicMentionsEnabled: true },
      })
      if (!user) return reply.status(404).send({ error: 'Artist not found' })
      if (!user.publicMentionsEnabled) {
        return reply.status(404).send({ error: 'Public mentions not enabled' })
      }

      const mentions = await fastify.prisma.mention.findMany({
        where: { targetUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          surface: true,
          createdAt: true,
          mentioner: { select: { username: true, displayName: true } },
        },
      })

      return reply.send(mentions)
    },
  )
}

export default publicMentionRoutes
