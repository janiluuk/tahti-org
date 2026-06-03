// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { signCentrifugoToken } from '../../lib/centrifugo-jwt.js'
import { verifyHcaptcha } from '../../lib/hcaptcha.js'

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
  fastify.post('/api/chat/:slug/token', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const { handle, hcaptchaToken } =
      (request.body as {
        handle?: string
        hcaptchaToken?: string
      }) ?? {}

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
      select: { id: true },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
      return reply.status(400).send({ error: 'handle is required' })
    }

    const cleanHandle = handle.trim().slice(0, 32)

    // Fingerprint: sha256(ip + user-agent + channel) — monthly salt kept in env
    const salt = process.env.FINGERPRINT_SALT ?? 'dev-salt'
    const ua = (request.headers['user-agent'] as string | undefined) ?? ''
    const fingerprint = createHash('sha256')
      .update(`${ip}:${ua}:${channel.id}:${salt}`)
      .digest('hex')
      .slice(0, 16)

    // Check ban before issuing token
    const ban = await fastify.prisma.chatBan.findUnique({
      where: { channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint } },
    })

    if (ban) return reply.status(403).send({ error: 'banned' })

    // sub encodes handle + fingerprint
    const sub = `${cleanHandle}#${fingerprint}`
    const token = signCentrifugoToken({ sub, channel: `channel:${slug}` }, 3600)

    return reply.send({ token, handle: cleanHandle, fingerprint })
  })
}

export default chatTokenRoute
