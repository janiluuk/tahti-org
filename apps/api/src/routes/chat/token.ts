// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
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
import { markChatCaptchaVerified } from '../../lib/chat-captcha.js'

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

      const captchaOk = await verifyHcaptcha(hcaptchaToken)
      if (!captchaOk) {
        return reply.status(400).send({ error: 'hCaptcha verification failed' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true },
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

      // Check ban before issuing token
      const ban = await fastify.prisma.chatBan.findUnique({
        where: {
          channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint },
        },
      })

      if (ban) return reply.status(403).send({ error: 'banned' })

      const supporter = request.sessionUser?.id
        ? await isActiveFanSubscriber(fastify.prisma, channel.userId, request.sessionUser.id)
        : false

      // sub encodes handle + fingerprint; info carries supporter badge for Centrifugo
      const sub = `${cleanHandle}#${fingerprint}`
      const token = signCentrifugoToken(
        { sub, channel: `channel:${slug}`, info: { supporter } },
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

      return reply.send({ token, handle: cleanHandle, fingerprint, supporter })
    },
  )
}

export default chatTokenRoute
