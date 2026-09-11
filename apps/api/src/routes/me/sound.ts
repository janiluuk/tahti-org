// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import meSoundCrudRoutes from './sound-crud.js'
import meSoundVisualAccessRoutes from './sound-visual-access.js'
import meSoundExportRoutes from './sound-export.js'

/** Artist sound library routes only — channel look/overlay plugins register via studio. */
const meSoundRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meSoundCrudRoutes)
  await fastify.register(meSoundVisualAccessRoutes)
  await fastify.register(meSoundExportRoutes)
}

export default meSoundRoutes
