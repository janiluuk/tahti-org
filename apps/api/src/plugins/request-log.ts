// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomUUID } from 'node:crypto'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string
  }
}

const QUIET_PATHS = new Set(['/health', '/api/v1/status', '/metrics'])

/** M11: structured request logging with correlation IDs (pino JSON via Fastify). */
const requestLogPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('requestId', '')

  fastify.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id']
    const requestId =
      typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID()
    request.requestId = requestId
    reply.header('x-request-id', requestId)
    request.log = request.log.child({ requestId })
  })

  fastify.addHook('onResponse', async (request, reply) => {
    if (process.env.NODE_ENV === 'test') return
    const path = request.url.split('?')[0]
    if (QUIET_PATHS.has(path)) return

    const entry: Record<string, string | number> = {
      event: 'http_request',
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }
    if (request.sessionUser?.id) entry.userId = request.sessionUser.id

    request.log.info(entry)
  })
}

export default fp(requestLogPlugin, { name: 'request-log' })
