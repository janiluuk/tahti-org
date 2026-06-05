// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { PrometheusMetricsBodySchema, openApiResponse } from '@tahti/shared'
import { renderPrometheusMetrics, runDependencyChecks } from '../lib/health-checks.js'
import { renderStripeWebhookMetricLines } from '../lib/stripe-webhook-metrics.js'

const metricsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/metrics',
    {
      schema: {
        tags: ['ops'],
        response: openApiResponse(PrometheusMetricsBodySchema, 'PrometheusMetricsBody'),
      },
    },
    async (_request, reply) => {
      const checks = await runDependencyChecks(fastify.prisma)
      const lines = [
        renderPrometheusMetrics(checks, Math.floor(process.uptime())).trimEnd(),
        ...renderStripeWebhookMetricLines(),
      ]
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(`${lines.join('\n')}\n`)
    },
  )
}

export default metricsRoute
