// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import collectionRoutes from '../routes/collections/collections.js'
import collectionCoverRoutes from '../routes/collections/cover.js'

export async function registerCollectionRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(collectionRoutes)
  await fastify.register(collectionCoverRoutes)
}
