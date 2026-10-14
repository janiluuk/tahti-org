// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ModerateChatItemParamsSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { resolveChannelForModeration } from '../../lib/channel-access.js'

const meModerateMessageRemove: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/me/moderate/:slug/chat/messages/:id — take a message out of
  // the channel's chat history. The row is kept and marked, so the record of
  // what was said survives; everyone who opens the chat afterwards no longer
  // gets it. People with the chat already open keep what they have on screen.
  fastify.delete(
    '/api/me/moderate/:slug/chat/messages/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ModerateChatItemParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const message = await fastify.prisma.chatMessage.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true, handle: true, channelRole: true, removedAt: true },
      })
      if (!message) return reply.status(404).send({ error: 'Message not found' })
      // A moderator tidies up after visitors; what the owner wrote in their
      // own room is the owner's to remove.
      if (message.channelRole === 'owner' && !channel.isOwner) {
        return reply.status(403).send({ error: "Only the channel's owner can remove this message" })
      }

      if (!message.removedAt) {
        await fastify.prisma.chatMessage.update({
          where: { id: message.id },
          data: { removedAt: new Date(), removedByUserId: user.id },
        })
        void auditLog(fastify.prisma, {
          action: 'CHAT_MESSAGE_DELETE',
          actorId: user.id,
          targetId: channel.id,
          meta: { messageId: message.id, handle: message.handle },
        })
      }

      return reply.status(204).send()
    },
  )
}

export default meModerateMessageRemove
