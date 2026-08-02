// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatPublishAckSchema,
  ChatPublishProxySchema,
  chatProxyMetaUserId,
  openApiResponse,
} from '@tahti/shared'
import { notifyUsersOfChatMention } from '@tahti/db'
import { isChatCaptchaVerified } from '../../lib/chat-captcha.js'
import { extractHandles, recordMentions } from '../../lib/mentions.js'

// Centrifugo proxy publish webhook.
// Centrifugo calls this before allowing a client to publish.
// We check if the sender is banned and validate message length.
//
// Centrifugo's HTTP proxy endpoint URLs are static (no per-channel
// templating), so the route is generic and the channel slug is derived
// from the proxy request body's `channel` field instead of a URL param —
// it arrives as `channel:<slug>` or `channel:<slug>:fans`.
const chatMessageRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/chat/message',
    { schema: { response: openApiResponse(ChatPublishAckSchema, 'ChatPublishAck') } },
    async (request, reply) => {
      const parsed = ChatPublishProxySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data
      const slug = body.channel.replace(/^channel:/, '').replace(/:fans$/, '')
      if (!slug) return reply.status(400).send({ error: 'Invalid channel' })

      const sub = body.user ?? ''
      const fingerprint = sub.split('#')[1] ?? ''
      const text = body.data?.text?.trim() ?? ''

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'channel not found' })

      if (fingerprint) {
        const verified = await isChatCaptchaVerified(channel.id, fingerprint)
        if (!verified) {
          return reply.status(403).send({ error: 'captcha_required' })
        }
        const ban = await fastify.prisma.chatBan.findUnique({
          where: {
            channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint },
          },
        })
        if (ban) return reply.status(403).send({ error: 'banned' })
      }

      // @mentions → Mention rows + in-app notifications (signed-in chatters only).
      const mentionerUserId = chatProxyMetaUserId(body.meta)
      if (mentionerUserId && text && extractHandles(text).length > 0) {
        const mentioner = await fastify.prisma.user.findUnique({
          where: { id: mentionerUserId },
          select: { id: true, username: true, displayName: true },
        })
        if (mentioner) {
          const sourceId = `chat:${channel.id}:${Date.now()}:${mentioner.id}`
          const targetIds = await recordMentions(
            fastify.prisma,
            mentioner.id,
            text,
            'CHAT',
            sourceId,
          )
          if (targetIds.length > 0) {
            await notifyUsersOfChatMention(fastify.prisma, targetIds, mentioner, slug, text)
          }
        }
      }

      // Return the data as-is — Centrifugo publishes it
      return reply.send({ result: {} })
    },
  )
}

export default chatMessageRoute
