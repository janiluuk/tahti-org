// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { renderHttpMetricLines } from '../lib/http-metrics.js'
import { renderPrometheusMetrics, runDependencyChecks } from '../lib/health-checks.js'
import {
  collectPlatformMetrics,
  renderPlatformMetricLines,
} from '../lib/platform-metrics.js'
import { renderStripeWebhookMetricLines } from '../lib/stripe-webhook-metrics.js'

const metricsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/metrics', async (_request, reply) => {
    const [checks, platform] = await Promise.all([
      runDependencyChecks(fastify.prisma),
      collectPlatformMetrics(fastify.prisma),
    ])
    const lines = [
      renderPrometheusMetrics(checks, Math.floor(process.uptime())).trimEnd(),
      ...renderPlatformMetricLines(platform),
      ...renderHttpMetricLines(),
      ...renderStripeWebhookMetricLines(),
    ]
    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(`${lines.join('\n')}\n`)
  })
}

export default metricsRoute
