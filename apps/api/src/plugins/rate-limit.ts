// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Redis token-bucket rate limiting for Fastify.
// Applied globally — individual routes can override limits via config.
// Default: 60 req/min per IP for API routes, 10 req/min for auth routes.

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'
import { getRedisClient } from '../lib/redis.js'
import { rateLimitWhenRedisUnavailable } from '../lib/rate-limit-fallback.js'

interface RateLimitConfig {
  max: number
  windowSec: number
  keyPrefix?: string
}

const AUTH_ROUTES = ['/api/auth/register', '/api/auth/login']

/** Chat POST (token issuance, publish proxy) — strict limit; GET discovery stays on API limit. */
function usesAuthRateLimit(url: string, method: string): boolean {
  if (AUTH_ROUTES.some((r) => url.startsWith(r))) return true
  return method === 'POST' && url.startsWith('/api/chat/')
}

function defaultLimit(): RateLimitConfig {
  return { max: config.rateLimit.apiMaxPerMin, windowSec: 60 }
}

function authLimit(): RateLimitConfig {
  return { max: config.rateLimit.authMaxPerMin, windowSec: 60 }
}

async function checkLimit(
  ip: string,
  route: string,
  limit: RateLimitConfig,
): Promise<{ ok: boolean; remaining: number; resetSec: number }> {
  const rd = await getRedisClient()
  if (!rd) {
    return rateLimitWhenRedisUnavailable(config.rateLimit.redisFailOpen, limit.windowSec)
  }
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
    if (
      request.url.startsWith('/internal/') ||
      request.url === '/health' ||
      request.url === '/metrics' ||
      request.url === '/api/v1/status' ||
      request.url === '/source'
    ) {
      return
    }

    const ip = request.ip ?? '0.0.0.0'

    if (
      (request.url.startsWith('/api/support/contact') ||
        request.url.startsWith('/api/beta/apply')) &&
      request.method === 'POST'
    ) {
      const limit = { max: 3, windowSec: 3600, keyPrefix: 'support' }
      const { ok, remaining, resetSec } = await checkLimit(ip, request.url, limit).catch(() =>
        rateLimitWhenRedisUnavailable(config.rateLimit.redisFailOpen, limit.windowSec),
      )
      reply.header('X-RateLimit-Remaining', remaining)
      reply.header('X-RateLimit-Reset', resetSec)
      if (!ok) {
        return reply
          .status(429)
          .send({ error: 'Too many support requests', retryAfterSec: resetSec })
      }
      return
    }

    const isAuthRoute = usesAuthRateLimit(request.url, request.method)
    const limit = isAuthRoute ? authLimit() : defaultLimit()

    const { ok, remaining, resetSec } = await checkLimit(ip, request.url, limit).catch(() =>
      rateLimitWhenRedisUnavailable(config.rateLimit.redisFailOpen, limit.windowSec),
    )

    reply.header('X-RateLimit-Remaining', remaining)
    reply.header('X-RateLimit-Reset', resetSec)

    if (!ok) {
      return reply.status(429).send({ error: 'Too many requests', retryAfterSec: resetSec })
    }
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit' })
