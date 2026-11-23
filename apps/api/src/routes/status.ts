// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ApiStatusResponseSchema, openApiResponse } from '@tahti/shared'
import { runDependencyChecks, summarizeChecks } from '../lib/health-checks.js'
import { config } from '../config.js'

// M11: public status surface (feeds self-hosted Upptime, Grafana, external monitors).
const statusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/status',
    {
      schema: {
        tags: ['admin'],
        description:
          'M11: dependency health for Upptime and ops monitors. 503 only when a critical dependency is down; a non-critical outage is 200 with status degraded.',
        response: openApiResponse(ApiStatusResponseSchema, 'ApiStatus'),
      },
    },
    async (_request, reply) => {
      const checks = await runDependencyChecks(fastify.prisma)
      const summary = summarizeChecks(checks)

      return reply.status(summary.healthy ? 200 : 503).send({
        status: summary.status,
        version: config.releaseVersion,
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
    },
  )
}

export default statusRoutes
