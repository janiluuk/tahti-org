// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import prepareUploadRoute from '../routes/uploads/prepare.js'
import completeUploadRoute from '../routes/uploads/complete.js'
import channelGetRoute from '../routes/channels/get.js'
import channelSlugRedirectRoute from '../routes/channels/slug-redirect.js'
import channelItemsRoute from '../routes/channels/items.js'
import trackGetRoute from '../routes/tracks/get.js'
import channelListRoute from '../routes/channels/list.js'
import channelDirectoryRoute from '../routes/channels/directory.js'
import tahtiSelectsGalleryRoute from '../routes/channels/tahti-selects-gallery.js'
import latestTracksRoute from '../routes/discover/latest-tracks.js'
import newToYouRoute from '../routes/discover/new-to-you.js'
import searchRoute from '../routes/discover/search.js'
import mcpRoute from '../routes/mcp/index.js'
import jamRoute from '../routes/jam/index.js'
import channelStatsRoute from '../routes/channels/stats.js'
import newsPublicRoute from '../routes/news/public.js'
import channelManageStatsRoute from '../routes/channels/manage-stats.js'
import channelRtmpStatusRoute from '../routes/channels/rtmp-status.js'
import channelTransportRoutes from '../routes/channels/transport.js'
import channelFallbackCollectionRoutes from '../routes/channels/fallback-collection.js'
import customDomainRoutes from '../routes/channels/custom-domain.js'
import liveFingerprintsRoute from '../routes/channels/live-fingerprints.js'

export async function registerChannelRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(prepareUploadRoute)
  await fastify.register(completeUploadRoute)
  await fastify.register(channelGetRoute)
  await fastify.register(channelSlugRedirectRoute)
  await fastify.register(channelItemsRoute)
  await fastify.register(trackGetRoute)
  await fastify.register(channelListRoute)
  await fastify.register(channelDirectoryRoute)
  await fastify.register(tahtiSelectsGalleryRoute)
  await fastify.register(newToYouRoute)
  await fastify.register(latestTracksRoute)
  await fastify.register(searchRoute)
  await fastify.register(mcpRoute)
  await fastify.register(jamRoute)
  await fastify.register(channelStatsRoute)
  await fastify.register(newsPublicRoute)
  await fastify.register(channelManageStatsRoute)
  await fastify.register(channelRtmpStatusRoute)
  await fastify.register(channelTransportRoutes)
  await fastify.register(channelFallbackCollectionRoutes)
  await fastify.register(customDomainRoutes)
  await fastify.register(liveFingerprintsRoute)
}
