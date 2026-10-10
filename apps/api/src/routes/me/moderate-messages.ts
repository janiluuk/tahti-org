// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ModerationChatMessageListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveChannelForModeration } from '../../lib/channel-access.js'

const MESSAGE_LIMIT = 100

const meModerateMessages: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/moderate/:slug/chat/messages — the channel's latest chat
  // messages, newest first, for its owner and moderators. Covers the fan room
  // too. Unlike the public history it carries message ids to act on.
  fastify.get(
    '/api/me/moderate/:slug/chat/messages',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ModerationChatMessageListSchema, 'ModerationChatMessageList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const rows = await fastify.prisma.chatMessage.findMany({
        where: { channelId: channel.id, removedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MESSAGE_LIMIT,
        select: {
          id: true,
          handle: true,
          text: true,
          fanOnly: true,
          channelRole: true,
          fingerprintHash: true,
          createdAt: true,
        },
      })

      const fingerprints = [...new Set(rows.flatMap((r) => r.fingerprintHash ?? []))]
      const bans =
        fingerprints.length > 0
          ? await fastify.prisma.chatBan.findMany({
              where: { channelId: channel.id, fingerprintHash: { in: fingerprints } },
              select: { fingerprintHash: true },
            })
          : []
      const banned = new Set(bans.map((b) => b.fingerprintHash))

      return reply.send({
        messages: rows.map((r) => {
          const channelRole =
            r.channelRole === 'owner' || r.channelRole === 'moderator' ? r.channelRole : null
          return {
            id: r.id,
            handle: r.handle,
            text: r.text,
            fanOnly: r.fanOnly,
            channelRole,
            createdAt: r.createdAt,
            // Messages sent before fingerprints were kept can't be traced to a
            // sender, and the people running the room are not banned from it.
            canBan: r.fingerprintHash !== null && channelRole === null,
            banned: r.fingerprintHash !== null && banned.has(r.fingerprintHash),
          }
        }),
      })
    },
  )
}

export default meModerateMessages
