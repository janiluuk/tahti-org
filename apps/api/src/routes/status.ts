// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { runDependencyChecks, summarizeChecks } from '../lib/health-checks.js'

// M11: public status surface (feeds self-hosted Upptime, Grafana, external monitors).
const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/status', async (_request, reply) => {
    const checks = await runDependencyChecks(fastify.prisma)
    const summary = summarizeChecks(checks)

    return reply.status(summary.healthy ? 200 : 503).send({
      status: summary.status,
      version: process.env.npm_package_version ?? '0.0.1',
      uptimeSec: Math.floor(process.uptime()),
      checks: Object.fromEntries(
        checks.map((c) => [
          c.id,
          {
            state: c.state,
            critical: c.critical,
            latencyMs: c.latencyMs,
            ...(c.detail ? { detail: c.detail } : {}),
          },
        ]),
      ),
      ts: new Date().toISOString(),
    })
  })
}

export default statusRoutes
