// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string
  }
}

/** M11: structured request logging with correlation IDs. */
const requestLogPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('requestId', '')

  fastify.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id']
    const requestId =
      typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID()
    request.requestId = requestId
    reply.header('x-request-id', requestId)
  })

  fastify.addHook('onResponse', async (request, reply) => {
    if (process.env.NODE_ENV === 'test') return
    request.log.info({
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    })
  })
}

export default requestLogPlugin
