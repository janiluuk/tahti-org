// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { renderPrometheusMetrics, runDependencyChecks } from '../lib/health-checks.js'

const metricsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/metrics', async (_request, reply) => {
    const checks = await runDependencyChecks(fastify.prisma)
    const body = renderPrometheusMetrics(checks, Math.floor(process.uptime()))
    return reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8').send(body)
  })
}

export default metricsRoute
