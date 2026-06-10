// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { ChatTokenOnlyResponseSchema, SlugParamSchema, openApiResponse, parseRouteParams } from '@tahti/shared'
import { signCentrifugoToken } from '../../lib/centrifugo-jwt.js'

// Rate limit: 30 viewer tokens per IP per minute — generous since this is
// issued automatically on page load (no captcha, read-only).
const tokenBucket = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = tokenBucket.get(ip)
  if (!entry || now > entry.reset) {
    tokenBucket.set(ip, { count: 1, reset: now + 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

const chatViewerTokenRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/:slug/viewer-token
  // Issues a read-only Centrifugo connection JWT so anonymous visitors who
  // haven't joined chat (picked a handle) still receive live messages.
  // The `viewer#<fingerprint>` sub is never captcha-verified, so the
  // chat_publish proxy rejects any publish attempt from this token —
  // posting still requires /api/chat/:slug/token.
  fastify.post(
    '/api/chat/:slug/viewer-token',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatTokenOnlyResponseSchema, 'ChatTokenOnly'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const ip = request.ip ?? '0.0.0.0'
      if (!checkRateLimit(ip)) {
        return reply.status(429).send({ error: 'Too many requests' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const salt = process.env.FINGERPRINT_SALT ?? 'dev-salt'
      const ua = (request.headers['user-agent'] as string | undefined) ?? ''
      const fingerprint = createHash('sha256')
        .update(`${ip}:${ua}:${channel.id}:${salt}`)
        .digest('hex')
        .slice(0, 16)

      const sub = `viewer#${fingerprint}`
      const token = signCentrifugoToken({ sub }, 3600)

      return reply.send({ token })
    },
  )
}

export default chatViewerTokenRoute
