// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  ChatTokenResponseSchema,
  ChatTokenSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { signCentrifugoToken } from '../../lib/centrifugo-jwt.js'
import { verifyHcaptcha } from '../../lib/hcaptcha.js'
import { isActiveFanSubscriber } from '../../lib/fansub.js'
import { isChatCaptchaVerified, markChatCaptchaVerified } from '../../lib/chat-captcha.js'
import { countryFromIp } from '../../lib/geoip.js'

// Rate limit: 10 tokens per IP per minute
const tokenBucket = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = tokenBucket.get(ip)
  if (!entry || now > entry.reset) {
    tokenBucket.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

const chatTokenRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/:slug/token { handle: string }
  // Issues a Centrifugo connection JWT. handle stored in localStorage by the client.
  fastify.post(
    '/api/chat/:slug/token',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatTokenResponseSchema, 'ChatToken'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = ChatTokenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { handle, hcaptchaToken } = parsed.data

      const ip = request.ip ?? '0.0.0.0'
      if (!checkRateLimit(ip)) {
        return reply.status(429).send({ error: 'Too many requests' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true, chatSubscribersOnly: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const cleanHandle = handle

      // Fingerprint: sha256(ip + user-agent + channel) — monthly salt kept in env
      const salt = process.env.FINGERPRINT_SALT ?? 'dev-salt'
      const ua = (request.headers['user-agent'] as string | undefined) ?? ''
      const fingerprint = createHash('sha256')
        .update(`${ip}:${ua}:${channel.id}:${salt}`)
        .digest('hex')
        .slice(0, 16)

      // hCaptcha guards the anonymous join path from bot spam — a signed-in
      // session is already a stronger anti-abuse signal than a captcha, and
      // the chat UI never renders a captcha widget for this endpoint (only
      // /signup does), so requiring one unconditionally left every signed-in
      // member unable to join a channel's chat wherever HCAPTCHA_SECRET is a
      // real, non-dev value — i.e. everywhere assertProductionSecrets()
      // requires it to be, so this endpoint was broken for everyone.
      //
      // A fingerprint that already solved hCaptcha on this channel within the
      // last 24h (markChatCaptchaVerified below, also reused by the publish
      // path — see chat-captcha.ts) skips a fresh solve, so a returning
      // anonymous visitor who reloads or comes back later the same day isn't
      // re-challenged for a captcha they already passed.
      const captchaOk =
        Boolean(request.sessionUser?.id) ||
        (await isChatCaptchaVerified(channel.id, fingerprint, { failOpen: false })) ||
        (await verifyHcaptcha(hcaptchaToken))
      if (!captchaOk) {
        return reply.status(400).send({ error: 'hCaptcha verification failed' })
      }

      // Check ban before issuing token
      const ban = await fastify.prisma.chatBan.findUnique({
        where: {
          channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint },
        },
      })

      if (ban) return reply.status(403).send({ error: 'banned' })

      const [supporter, sessionUserCountry, channelRole] = await Promise.all([
        request.sessionUser?.id
          ? isActiveFanSubscriber(fastify.prisma, channel.userId, request.sessionUser.id)
          : Promise.resolve(false),
        request.sessionUser?.id
          ? fastify.prisma.user
              .findUnique({ where: { id: request.sessionUser.id }, select: { countryCode: true } })
              .then((u) => u?.countryCode ?? null)
          : Promise.resolve(null),
        request.sessionUser?.id
          ? resolveChatChannelRole(
              fastify.prisma,
              channel.id,
              channel.userId,
              request.sessionUser.id,
            )
          : Promise.resolve(null),
      ])

      const countryCode = sessionUserCountry ?? countryFromIp(ip)

      if (channel.chatSubscribersOnly && !supporter) {
        return reply.status(403).send({ error: 'subscribers_only' })
      }

      const sessionUserId = request.sessionUser?.id ?? null
      // sub encodes handle + fingerprint; info carries badges + country for Centrifugo;
      // meta.userId is backend-only so the publish proxy can notify @mentions.
      const sub = `${cleanHandle}#${fingerprint}`
      // Connection JWTs can't carry a `channel` claim in Centrifugo v5 (only
      // subscription JWTs can) — the client subscribes explicitly after connect.
      const token = signCentrifugoToken(
        {
          sub,
          info: { supporter, countryCode, channelRole },
          ...(sessionUserId ? { meta: { userId: sessionUserId } } : {}),
        },
        3600,
      )

      await markChatCaptchaVerified(channel.id, fingerprint)

      // LISTENER-003: cookie survives localStorage clears (non-HttpOnly so client can read it too).
      reply.setCookie('tahti_chat_handle', cleanHandle, {
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: false,
      })

      return reply.send({
        token,
        handle: cleanHandle,
        fingerprint,
        supporter,
        countryCode,
        channelRole,
      })
    },
  )
}

async function resolveChatChannelRole(
  prisma: PrismaClient,
  channelId: string,
  ownerUserId: string,
  userId: string,
): Promise<'owner' | 'moderator' | null> {
  if (userId === ownerUserId) return 'owner'
  const mod = await prisma.channelModerator.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  })
  return mod ? 'moderator' : null
}

export default chatTokenRoute
