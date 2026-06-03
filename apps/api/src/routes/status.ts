// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createClient } from 'redis'
import { config } from '../config.js'

// M11: public status surface (feeds self-hosted Upptime or external monitors).
const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/status', async (_request, reply) => {
    let dbOk = false
    let redisOk = false

    try {
      await fastify.prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch {
      // degraded
    }

    try {
      const client = createClient({ url: config.redisUrl })
      await client.connect()
      const pong = await client.ping()
      redisOk = pong === 'PONG'
      await client.quit()
    } catch {
      // redis optional in dev — mark degraded not error if db ok
    }

    const checks = {
      database: dbOk ? 'up' : 'down',
      redis: redisOk ? 'up' : 'down',
      api: 'up',
    }
    const healthy = dbOk && redisOk
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'operational' : 'degraded',
      version: process.env.npm_package_version ?? '0.0.1',
      uptimeSec: Math.floor(process.uptime()),
      checks,
      ts: new Date().toISOString(),
    })
  })
}

export default statusRoutes
