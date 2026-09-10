// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import meReleaseRoutes from '../routes/releases/me.js'
import releaseTrackRoutes from '../routes/releases/tracks.js'
import releaseTrackVersionRoutes from '../routes/releases/track-versions.js'
import releaseArtworkRoutes from '../routes/releases/artwork.js'
import releaseDownloadRoutes from '../routes/downloads/release.js'
import embedRoutes from '../routes/releases/embed.js'
import publicProfileRoutes from '../routes/profile/public.js'
import publicMentionRoutes from '../routes/profile/mentions.js'
import smartlinkRoutes from '../routes/releases/smartlink.js'
import smartlinkClickRoutes from '../routes/releases/smartlink-click.js'
import latestReleasesRoutes from '../routes/releases/latest.js'
import releaseAnalyticsRoutes from '../routes/releases/analytics.js'
import sitemapRoutes from '../routes/sitemap.js'
import ogRoutes from '../routes/og.js'
import meProfileRoutes from '../routes/me/profile.js'
import meTotpRoutes from '../routes/me/totp.js'
import meAvatarRoutes from '../routes/me/avatar.js'
import meMediaRoutes from '../routes/me/media.js'
import meChannelBackdropRoutes from '../routes/me/channel-backdrop.js'
import mePrivacyRoutes, { publicPressKitRoutes } from '../routes/me/privacy.js'
import mePressKitImages from '../routes/me/press-kit-images.js'
import meRadioSlotBookings from '../routes/me/radio-slot-bookings.js'

export async function registerReleaseRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(meReleaseRoutes)
  await fastify.register(releaseTrackRoutes)
  await fastify.register(releaseTrackVersionRoutes)
  await fastify.register(releaseArtworkRoutes)
  await fastify.register(releaseDownloadRoutes)
  await fastify.register(embedRoutes)
  await fastify.register(publicProfileRoutes)
  await fastify.register(publicMentionRoutes)
  await fastify.register(smartlinkRoutes)
  await fastify.register(smartlinkClickRoutes)
  await fastify.register(latestReleasesRoutes)
  await fastify.register(releaseAnalyticsRoutes)
  await fastify.register(sitemapRoutes)
  await fastify.register(ogRoutes)
  await fastify.register(meProfileRoutes)
  await fastify.register(meTotpRoutes)
  await fastify.register(meAvatarRoutes)
  await fastify.register(meMediaRoutes)
  await fastify.register(meChannelBackdropRoutes)
  await fastify.register(mePrivacyRoutes)
  await fastify.register(mePressKitImages)
  await fastify.register(publicPressKitRoutes)
  await fastify.register(meRadioSlotBookings)
}
