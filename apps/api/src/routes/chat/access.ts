// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatAccessResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { resolveChatChannelRole } from '../../lib/chat-role.js'
import { artistOffersFanChat, canUseFanChat } from '../../lib/fan-perks.js'
import { isActiveFanSubscriber } from '../../lib/fansub.js'

const chatAccessRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/chat/:slug/access — public chat + fan-chat eligibility for current session
  fastify.get(
    '/api/chat/:slug/access',
    { schema: { response: openApiResponse(ChatAccessResponseSchema, 'ChatAccessResponse') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: {
          id: true,
          userId: true,
          chatSubscribersOnly: true,
          user: { select: { chatEnabled: true, username: true } },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const fanChatEnabled = await artistOffersFanChat(fastify.prisma, channel.userId)
      const user = request.sessionUser
      let isSupporter = false
      let canJoinFanChat = false
      let runsTheRoom = false

      if (user) {
        runsTheRoom =
          (await resolveChatChannelRole(fastify.prisma, channel.id, channel.userId, user.id)) !==
          null
        isSupporter = await isActiveFanSubscriber(fastify.prisma, channel.userId, user.id)
        canJoinFanChat = await canUseFanChat(fastify.prisma, channel.userId, user.id)
      }

      return reply.send({
        chatEnabled: channel.user.chatEnabled,
        artistUsername: channel.user.username,
        fanChatEnabled,
        isSupporter,
        canJoinFanChat,
        subscribersOnly: channel.chatSubscribersOnly,
        canPostInChat: !channel.chatSubscribersOnly || isSupporter || runsTheRoom,
      })
    },
  )
}

export default chatAccessRoute
