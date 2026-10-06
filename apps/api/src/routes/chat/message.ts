// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import {
  ChatPublishProxyReplySchema,
  ChatPublishProxySchema,
  chatProxyTokenMeta,
  openApiResponse,
} from '@tahti/shared'
import { notifyUsersOfChatMention } from '@tahti/db'
import { isChatCaptchaVerified } from '../../lib/chat-captcha.js'
import { extractHandles, recordMentions } from '../../lib/mentions.js'
import { auditLog } from '../../lib/audit.js'
import { canUseFanChat } from '../../lib/fan-perks.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'

// Centrifugo proxy publish webhook.
// Centrifugo calls this before allowing a client to publish.
// We check if the sender is banned and validate message length.
//
// Centrifugo's HTTP proxy endpoint URLs are static (no per-channel
// templating), so the route is generic and the channel slug is derived
// from the proxy request body's `channel` field instead of a URL param —
// it arrives as `channel:<slug>` or `channel:<slug>:fans`.
// Centrifugo turns any non-200 proxy reply into a generic "internal server
// error" for the browser, so refusals go back as a 200 carrying its error
// object (codes must be in 400-1999) with the code string as the message.
function refusePublish(reply: FastifyReply, code: 403 | 404, message: string) {
  return reply.send({ error: { code, message } })
}

const chatMessageRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/chat/message',
    { schema: { response: openApiResponse(ChatPublishProxyReplySchema, 'ChatPublishProxyReply') } },
    async (request, reply) => {
      const parsed = ChatPublishProxySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data
      const slug = body.channel.replace(/^channel:/, '').replace(/:fans$/, '')
      if (!slug) return reply.status(400).send({ error: 'Invalid channel' })

      // `sub` is `<handle>#<fingerprint>`; a handle may itself hold a `#`.
      const sub = body.user ?? ''
      const subSplit = sub.lastIndexOf('#')
      const fingerprint = subSplit === -1 ? '' : sub.slice(subSplit + 1)
      const text = body.data?.text?.trim() ?? ''
      const isFanChannel = body.channel.endsWith(':fans')
      const tokenMeta = chatProxyTokenMeta(body.meta)
      const mentionerUserId = tokenMeta.userId

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true, user: { select: { chatEnabled: true } } },
      })

      if (!channel) return refusePublish(reply, 404, 'channel not found')
      // Tokens issued before the owner switched chat off stay valid for up to
      // an hour, so the toggle has to be enforced at publish time as well.
      if (!channel.user.chatEnabled) return refusePublish(reply, 403, 'chat_disabled')

      // A connection token opens every chat Centrifugo lets a client
      // subscribe to, but the join checks behind it (ban, captcha,
      // subscribers-only, badges) were made for one channel only. The
      // fingerprint in it is per channel too, so on another channel the ban
      // lookup below would never match.
      if (tokenMeta.channelId && tokenMeta.channelId !== channel.id) {
        return refusePublish(reply, 403, 'wrong_channel')
      }

      // Any client may subscribe in the `channel` namespace, so the fan room is
      // only kept to fans by refusing posts from anyone else here.
      if (
        isFanChannel &&
        !(mentionerUserId && (await canUseFanChat(fastify.prisma, channel.userId, mentionerUserId)))
      ) {
        return refusePublish(reply, 403, 'fan_chat_required')
      }

      // A block between the sender and the channel's owner, in either
      // direction, closes the owner's chat to the sender. It reads as a ban,
      // so a block is not announced.
      if (
        mentionerUserId &&
        mentionerUserId !== channel.userId &&
        (await isBlockedEitherWay(fastify.prisma, channel.userId, mentionerUserId))
      ) {
        return refusePublish(reply, 403, 'banned')
      }

      if (fingerprint) {
        // Same reasoning as token.ts's join-time bypass: a signed-in session
        // is a stronger anti-abuse signal than hCaptcha, and re-checking the
        // Redis-cached join-time verification here left signed-in senders
        // blocked with "captcha_required" whenever that cache entry wasn't
        // there for any reason (TTL, a Redis blip, a fingerprint recomputed
        // after a UA/IP change mid-session) — captcha was already skipped
        // for them at join, this publish-time check just never knew that.
        if (!mentionerUserId) {
          const verified = await isChatCaptchaVerified(channel.id, fingerprint)
          if (!verified) {
            return refusePublish(reply, 403, 'captcha_required')
          }
        }
        const ban = await fastify.prisma.chatBan.findUnique({
          where: {
            channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint },
          },
        })
        if (ban) return refusePublish(reply, 403, 'banned')
      }

      // @mentions → Mention rows + in-app notifications (signed-in chatters only).
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

      // Who posted and with which badges comes from the signed token, not from
      // the message: the client writes `data`, so a handle or an owner badge
      // taken from there could be anyone's.
      const data = (body.data ?? {}) as Record<string, unknown>
      const handle =
        (subSplit > 0 && sub.slice(0, subSplit)) ||
        (typeof data.handle === 'string' && data.handle.trim()) ||
        'anon'
      const supporter = isFanChannel || tokenMeta.supporter
      const channelRole = tokenMeta.channelRole
      const countryCode = tokenMeta.countryCode

      // Permanent record — Centrifugo's own history is a 1h rolling in-memory
      // buffer with nothing surviving a restart. This is the only place a
      // user-typed message is ever seen server-side (system-generated
      // messages, e.g. love announcements, publish straight to Centrifugo
      // from elsewhere and skip this proxy, so they aren't captured here).
      if (text) {
        const message = await fastify.prisma.chatMessage.create({
          data: {
            channelId: channel.id,
            fanOnly: isFanChannel,
            handle,
            text,
            userId: mentionerUserId,
            supporter,
            channelRole,
            countryCode,
          },
        })
        // No message body here by design — the audit log is broadly readable
        // by board members and isn't the place for user-typed chat content.
        void auditLog(fastify.prisma, {
          action: 'CHAT_MESSAGE_SEND',
          actorId: mentionerUserId ?? 'anonymous',
          targetId: channel.id,
          meta: { messageId: message.id, fanOnly: isFanChannel, handle },
        })
      }

      if (!body.data) return reply.send({ result: {} })
      // Centrifugo publishes `result.data` in place of what the client sent.
      const rest = { ...data }
      for (const key of ['supporter', 'channelRole', 'countryCode', 'system']) delete rest[key]
      return reply.send({
        result: {
          data: {
            ...rest,
            handle,
            ...(supporter ? { supporter } : {}),
            ...(channelRole ? { channelRole } : {}),
            ...(countryCode ? { countryCode } : {}),
          },
        },
      })
    },
  )
}

export default chatMessageRoute
