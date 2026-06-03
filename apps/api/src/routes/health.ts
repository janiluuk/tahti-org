// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { checksToRecord, runDependencyChecks, summarizeChecks } from '../lib/health-checks.js'

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const checks = await runDependencyChecks(fastify.prisma)
    const summary = summarizeChecks(checks)
    const postgres = checks.find((c) => c.id === 'postgres')

    return reply.status(postgres?.state === 'up' ? 200 : 503).send({
      status: postgres?.state === 'up' ? (summary.healthy ? 'ok' : 'degraded') : 'error',
      db: postgres?.state === 'up' ? 'ok' : 'error',
      checks: checksToRecord(checks),
      uptime: Math.floor(process.uptime()),
      ts: new Date().toISOString(),
    })
  })
}

export default healthRoute
