// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatOkResponseSchema,
  ModerateChatItemParamsSchema,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { resolveChannelForModeration } from '../../lib/channel-access.js'

const meModerateMessageBan: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/moderate/:slug/chat/messages/:id/ban — ban whoever sent this
  // message. The fingerprint is read from the stored message, so the people
  // running the room never handle one.
  fastify.post(
    '/api/me/moderate/:slug/chat/messages/:id/ban',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: ChatOkResponseSchema, name: 'ChatOkResponse' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ModerateChatItemParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const message = await fastify.prisma.chatMessage.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true, handle: true, fingerprintHash: true, channelRole: true },
      })
      if (!message) return reply.status(404).send({ error: 'Message not found' })
      if (message.channelRole === 'owner' || message.channelRole === 'moderator') {
        return reply
          .status(400)
          .send({ error: 'The owner and moderators of a channel cannot be banned from its chat' })
      }
      if (!message.fingerprintHash) {
        return reply.status(400).send({ error: 'This message is too old to tell who sent it' })
      }

      await fastify.prisma.chatBan.upsert({
        where: {
          channelId_fingerprintHash: {
            channelId: channel.id,
            fingerprintHash: message.fingerprintHash,
          },
        },
        create: {
          channelId: channel.id,
          fingerprintHash: message.fingerprintHash,
          handle: message.handle,
          bannedByUserId: user.id,
        },
        update: { handle: message.handle },
      })
      void auditLog(fastify.prisma, {
        action: 'CHAT_BAN',
        actorId: user.id,
        targetId: channel.id,
        meta: { messageId: message.id, handle: message.handle },
      })

      return reply.status(201).send({ ok: true })
    },
  )

  // DELETE /api/me/moderate/:slug/chat/bans/:id — lift a ban by its id. The
  // older route takes the fingerprint in the path, which only fits hex hashes
  // of 16 characters or more.
  fastify.delete(
    '/api/me/moderate/:slug/chat/bans/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ModerateChatItemParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.chatBan.deleteMany({
        where: { id: routeParams.id, channelId: channel.id },
      })

      return reply.status(204).send()
    },
  )
}

export default meModerateMessageBan
