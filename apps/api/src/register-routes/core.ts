// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import healthRoute from '../routes/health.js'
import versionRoute from '../routes/version.js'
import statusRoutes from '../routes/status.js'
import metricsRoute from '../routes/metrics.js'
import sourceRoute from '../routes/source.js'
import publicApiDocsRoute from '../routes/public-api-docs.js'

export async function registerCoreRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoute)
  await fastify.register(versionRoute)
  await fastify.register(statusRoutes)
  await fastify.register(metricsRoute)
  await fastify.register(sourceRoute)
  await fastify.register(publicApiDocsRoute)
}
