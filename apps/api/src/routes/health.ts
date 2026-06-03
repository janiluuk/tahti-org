// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    let dbOk = false
    try {
      await fastify.prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch {
      // DB not connected — still return degraded response
    }

    const status = dbOk ? 'ok' : 'degraded'
    return reply.status(dbOk ? 200 : 503).send({
      status,
      db: dbOk ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      ts: new Date().toISOString(),
    })
  })
}

export default healthRoute
