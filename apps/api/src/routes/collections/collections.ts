// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import meCollectionRoutes from './me.js'
import { collectionThemeRoutes } from './theme.js'
import { publicCollectionRoutes } from './public.js'

const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meCollectionRoutes)
  await fastify.register(collectionThemeRoutes)
  await fastify.register(publicCollectionRoutes)
}

export default collectionRoutes
