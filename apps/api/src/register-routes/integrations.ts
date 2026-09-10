// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import mixcloudRoutes from '../routes/me/mixcloud.js'
import bandcampRoutes from '../routes/me/bandcamp.js'
import soundcloudRoutes from '../routes/me/soundcloud.js'
import googleDriveRoutes from '../routes/me/google-drive.js'
import meImportPluginRoutes from '../routes/me/import-plugins.js'
import meExportPluginRoutes from '../routes/me/export-plugins.js'
import musicbrainzRoutes from '../routes/me/musicbrainz.js'
import spotifyImportRoutes from '../routes/imports/spotify.js'
import spotifyProfileRoute from '../routes/me/spotify-profile.js'
import mixcloudEmbedImportRoutes from '../routes/imports/mixcloud-embed.js'
import hearthisImportRoutes from '../routes/imports/hearthis.js'
import revelatorRoutes from '../routes/me/revelator.js'

export async function registerIntegrationRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(mixcloudRoutes)
  await fastify.register(bandcampRoutes)
  await fastify.register(soundcloudRoutes)
  await fastify.register(googleDriveRoutes)
  await fastify.register(meImportPluginRoutes)
  await fastify.register(meExportPluginRoutes)
  await fastify.register(musicbrainzRoutes)
  await fastify.register(spotifyImportRoutes)
  await fastify.register(spotifyProfileRoute)
  await fastify.register(mixcloudEmbedImportRoutes)
  await fastify.register(hearthisImportRoutes)
  await fastify.register(revelatorRoutes)
}
