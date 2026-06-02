// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import sensible from '@fastify/sensible'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import healthRoute from './routes/health.js'
import sourceRoute from './routes/source.js'
import registerRoute from './routes/auth/register.js'
import verifyRoute from './routes/auth/verify.js'
import loginRoute from './routes/auth/login.js'
import logoutRoute from './routes/auth/logout.js'
import meRoute from './routes/auth/me.js'
import prepareUploadRoute from './routes/uploads/prepare.js'
import completeUploadRoute from './routes/uploads/complete.js'
import channelGetRoute from './routes/channels/get.js'
import channelItemsRoute from './routes/channels/items.js'
import itemReadyRoute from './routes/internal/item-ready.js'
import rtmpRoutes from './routes/internal/rtmp.js'
import icecastRoutes from './routes/internal/icecast.js'
import channelFallbackRoute from './routes/internal/channel-fallback.js'
import streamSettingsRoutes from './routes/me/stream-settings.js'
import chatTokenRoute from './routes/chat/token.js'
import chatMessageRoute from './routes/chat/message.js'
import chatAnnouncementsRoute from './routes/chat/announcements.js'
import meChat from './routes/me/chat.js'
import rtmpTargetRoutes from './routes/me/rtmp-targets.js'
import transparencyRoutes from './routes/transparency/index.js'
import adminLedgerRoutes from './routes/admin/ledger.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import { config } from './config.js'

export interface BuildOptions {
  logger?: boolean | object
}

export async function buildApp(opts: BuildOptions = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? config.nodeEnv !== 'test',
  })

  // Plugins
  await fastify.register(cookie)
  await fastify.register(sensible)
  await fastify.register(dbPlugin)
  await fastify.register(authPlugin)
  await fastify.register(rateLimitPlugin)

  // Add Source-Code header for AGPL §13 compliance
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Source-Code', config.sourceRepoUrl)
  })

  // Routes
  await fastify.register(healthRoute)
  await fastify.register(sourceRoute)
  await fastify.register(registerRoute)
  await fastify.register(verifyRoute)
  await fastify.register(loginRoute)
  await fastify.register(logoutRoute)
  await fastify.register(meRoute)
  await fastify.register(prepareUploadRoute)
  await fastify.register(completeUploadRoute)
  await fastify.register(channelGetRoute)
  await fastify.register(channelItemsRoute)
  await fastify.register(itemReadyRoute)

  // M3: live ingest webhooks + stream settings
  await fastify.register(rtmpRoutes)
  await fastify.register(icecastRoutes)
  await fastify.register(channelFallbackRoute)
  await fastify.register(streamSettingsRoutes)

  // M5: chat
  await fastify.register(chatTokenRoute)
  await fastify.register(chatMessageRoute)
  await fastify.register(chatAnnouncementsRoute)
  await fastify.register(meChat)

  // M6: RTMP multistream targets
  await fastify.register(rtmpTargetRoutes)

  // M8: transparency ledger
  await fastify.register(transparencyRoutes)
  await fastify.register(adminLedgerRoutes)

  return fastify
}
