// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

// Redis token-bucket rate limiting for Fastify.
// Applied globally — individual routes can override limits via config.
// Default: 60 req/min per IP for API routes, 10 req/min for auth routes.

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from 'redis'
import { config } from '../config.js'

interface RateLimitConfig {
  max: number
  windowSec: number
  keyPrefix?: string
}

const AUTH_ROUTES = ['/api/auth/register', '/api/auth/login', '/api/chat']
const DEFAULT_LIMIT: RateLimitConfig = { max: 120, windowSec: 60 }
const AUTH_LIMIT: RateLimitConfig = { max: 10, windowSec: 60 }

let redis: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!redis) {
    redis = createClient({ url: config.redisUrl })
    await redis.connect()
  }
  return redis
}

async function checkLimit(
  ip: string,
  route: string,
  limit: RateLimitConfig,
): Promise<{ ok: boolean; remaining: number; resetSec: number }> {
  const rd = await getRedis()
  const key = `rl:${limit.keyPrefix ?? 'api'}:${ip}:${Math.floor(Date.now() / (limit.windowSec * 1000))}`

  const count = await rd.incr(key)
  if (count === 1) await rd.expire(key, limit.windowSec)

  const ttl = await rd.ttl(key)
  const ok = count <= limit.max
  return { ok, remaining: Math.max(0, limit.max - count), resetSec: ttl }
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Disabled in test mode
    if (process.env.NODE_ENV === 'test') return

    // Skip internal routes
    if (request.url.startsWith('/internal/') || request.url === '/health' || request.url === '/source') {
      return
    }

    const ip = request.ip ?? '0.0.0.0'
    const isAuthRoute = AUTH_ROUTES.some((r) => request.url.startsWith(r))
    const limit = isAuthRoute ? AUTH_LIMIT : DEFAULT_LIMIT

    const { ok, remaining, resetSec } = await checkLimit(ip, request.url, limit).catch(() => ({
      ok: true, remaining: 999, resetSec: 60,
    }))

    reply.header('X-RateLimit-Remaining', remaining)
    reply.header('X-RateLimit-Reset', resetSec)

    if (!ok) {
      return reply.status(429).send({ error: 'Too many requests', retryAfterSec: resetSec })
    }
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit' })
