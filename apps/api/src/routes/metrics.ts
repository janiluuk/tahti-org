// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { PrometheusMetricsBodySchema, openApiResponse } from '@tahti/shared'
import { config } from '../config.js'
import { isTrustedInternalRequest } from '../lib/internal-request.js'
import { collectBackupMetrics, renderBackupMetricLines } from '../lib/backup-metrics.js'
import { renderAcrcloudMetricLines } from '../lib/acrcloud-metrics.js'
import { renderPrometheusMetrics, runDependencyChecks } from '../lib/health-checks.js'
import { renderHttpMetricLines } from '../lib/http-metrics.js'
import { collectPlatformMetrics, renderPlatformMetricLines } from '../lib/platform-metrics.js'
import { renderStripeWebhookMetricLines } from '../lib/stripe-webhook-metrics.js'

const metricsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/metrics',
    {
      schema: {
        tags: ['ops'],
        response: openApiResponse(PrometheusMetricsBodySchema, 'PrometheusMetricsBody'),
      },
      preHandler: async (request, reply) => {
        if (config.nodeEnv !== 'production') return
        const token = config.metricsToken
        if (token && request.headers.authorization === `Bearer ${token}`) return
        if (isTrustedInternalRequest(request)) return
        return reply.code(403).send({ error: 'Forbidden' })
      },
    },
    async (_request, reply) => {
      const checks = await runDependencyChecks(fastify.prisma)
      const platform = await collectPlatformMetrics(fastify.prisma)
      const backup = await collectBackupMetrics()
      const lines = [
        renderPrometheusMetrics(checks, Math.floor(process.uptime())).trimEnd(),
        ...renderHttpMetricLines(),
        ...renderPlatformMetricLines(platform),
        ...renderBackupMetricLines(backup),
        ...renderAcrcloudMetricLines(),
        ...renderStripeWebhookMetricLines(),
      ]
      return reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(`${lines.join('\n')}\n`)
    },
  )
}

export default metricsRoute
