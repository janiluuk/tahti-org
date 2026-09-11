// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import meSoundCrudRoutes from './sound-crud.js'
import meSoundVisualAccessRoutes from './sound-visual-access.js'
import meSoundExportRoutes from './sound-export.js'
import meChannelGalleryRoutes from './channel-gallery.js'
import meChannelTextLayerRoutes from './channel-text-layer.js'
import meChannelVisualRoutes from './channel-visual.js'
import meChannelStreamOverlayRoutes from './channel-stream-overlay.js'

const meSoundRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meSoundCrudRoutes)
  await fastify.register(meSoundVisualAccessRoutes)
  await fastify.register(meSoundExportRoutes)
  await fastify.register(meChannelGalleryRoutes)
  await fastify.register(meChannelTextLayerRoutes)
  await fastify.register(meChannelVisualRoutes)
  await fastify.register(meChannelStreamOverlayRoutes)
}

export default meSoundRoutes
