// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import itemReadyRoute from '../routes/internal/item-ready.js'
import rtmpRoutes from '../routes/internal/rtmp.js'
import icecastRoutes from '../routes/internal/icecast.js'
import channelFallbackRoute from '../routes/internal/channel-fallback.js'
import tlsAskRoute from '../routes/internal/tls-ask.js'
import broadcastFingerprintInternalRoutes from '../routes/internal/broadcast-fingerprint.js'
import internalRadioRoutes from '../routes/internal/radio.js'
import internalDiscordBotRoutes from '../routes/internal/discord-bot.js'
import streamSettingsRoutes from '../routes/me/stream-settings.js'
import channelSlugRoutes from '../routes/me/channel-slug.js'

export async function registerInternalRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(itemReadyRoute)
  await fastify.register(rtmpRoutes)
  await fastify.register(icecastRoutes)
  await fastify.register(channelFallbackRoute)
  await fastify.register(tlsAskRoute)
  await fastify.register(broadcastFingerprintInternalRoutes)
  await fastify.register(internalRadioRoutes)
  await fastify.register(internalDiscordBotRoutes)
  await fastify.register(streamSettingsRoutes)
  await fastify.register(channelSlugRoutes)
}
