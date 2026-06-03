// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import {
  ChatOkResponseSchema,
  ChatReactSchema,
  ChatTokenOnlyResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'

// In-memory rate limit: max 3 reactions per fingerprint per 5s window
const reactBucket = new Map<string, { count: number; reset: number }>()

function checkReactLimit(key: string): boolean {
  const now = Date.now()
  const entry = reactBucket.get(key)
  if (!entry || now > entry.reset) {
    reactBucket.set(key, { count: 1, reset: now + 5_000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

// Periodically prune stale entries (unref so one-shot scripts can exit)
const pruneTimer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of reactBucket) {
    if (now > v.reset) reactBucket.delete(k)
  }
}, 60_000)
pruneTimer.unref()

const chatReactRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/:slug/react { emoji: string }
  fastify.post(
    '/api/chat/:slug/react',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatOkResponseSchema, 'ChatOk'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = ChatReactSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid emoji' })
      }
      const { emoji } = parsed.data

      const ip = request.ip ?? '0.0.0.0'
      const ua = (request.headers['user-agent'] as string | undefined) ?? ''
      const fingerprint = createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 16)

      if (!checkReactLimit(fingerprint)) {
        return reply.status(429).send({ error: 'Slow down' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      // Publish via Centrifugo server API
      await fetch(`${config.centrifugo.apiUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `apikey ${config.centrifugo.apiKey}`,
        },
        body: JSON.stringify({
          method: 'publish',
          params: {
            channel: `reactions:${slug}`,
            data: { emoji, ts: Date.now() },
          },
        }),
      }).catch((err: unknown) => fastify.log.warn({ err }, 'centrifugo publish failed'))

      return reply.send({ ok: true })
    },
  )

  // GET /api/chat/:slug/reactions-token — anonymous Centrifugo token for reactions channel
  fastify.get(
    '/api/chat/:slug/reactions-token',
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

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { signCentrifugoToken } = await import('../../lib/centrifugo-jwt.js')
      const token = signCentrifugoToken({ sub: `anon:${Date.now()}` }, 7200)

      return reply.send({ token })
    },
  )
}

export default chatReactRoute
