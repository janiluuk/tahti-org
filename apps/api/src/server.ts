// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import sensible from '@fastify/sensible'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import healthRoute from './routes/health.js'
import statusRoutes from './routes/status.js'
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
import chatReactRoute from './routes/chat/react.js'
import chatPresenceRoute from './routes/chat/presence.js'
import meChat from './routes/me/chat.js'
import rtmpTargetRoutes from './routes/me/rtmp-targets.js'
import transparencyRoutes from './routes/transparency/index.js'
import adminLedgerRoutes from './routes/admin/ledger.js'
import governanceRoutes from './routes/governance/index.js'
import downloadRoutes from './routes/downloads/archive.js'
import meGrantsRoutes from './routes/me/grants.js'
import adminGrantsRoutes from './routes/admin/grants.js'
import fanTierRoutes from './routes/fansubs/tiers.js'
import fanSubscriptionRoutes from './routes/fansubs/subscriptions.js'
import stripeWebhookRoutes from './routes/webhooks/stripe.js'
import membershipRoutes from './routes/me/membership.js'
import broadcastUsageRoutes from './routes/me/broadcast-usage.js'
import adminMembersRoutes from './routes/admin/members.js'
import adminAuditRoutes from './routes/admin/audit.js'
import meReleaseRoutes from './routes/releases/me.js'
import publicProfileRoutes from './routes/profile/public.js'
import smartlinkRoutes from './routes/releases/smartlink.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import { config } from './config.js'

export interface BuildOptions {
  logger?: boolean | object
}

export async function buildApp(opts: BuildOptions = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? config.nodeEnv !== 'test',
    trustProxy: true,
  })

  // Plugins
  await fastify.register(cookie)
  await fastify.register(formbody)
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
  await fastify.register(statusRoutes)
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
  await fastify.register(chatReactRoute)
  await fastify.register(chatPresenceRoute)
  await fastify.register(meChat)

  // M6: RTMP multistream targets
  await fastify.register(rtmpTargetRoutes)

  // M8: transparency ledger
  await fastify.register(transparencyRoutes)
  await fastify.register(adminLedgerRoutes)

  // M10: member governance (motions + advisory voting)
  await fastify.register(governanceRoutes)

  // M18: downloads as first-class action (engagement units)
  await fastify.register(downloadRoutes)

  // M9: annual grant disbursements
  await fastify.register(meGrantsRoutes)
  await fastify.register(adminGrantsRoutes)

  // M19: fan-to-artist subscriptions
  await fastify.register(fanTierRoutes)
  await fastify.register(fanSubscriptionRoutes)
  await fastify.register(stripeWebhookRoutes)

  // M1: annual membership payment
  await fastify.register(membershipRoutes)
  await fastify.register(adminMembersRoutes)

  // M20: tier gating
  await fastify.register(broadcastUsageRoutes)

  // M11: audit exports
  await fastify.register(adminAuditRoutes)

  // M12: artist profile + releases
  await fastify.register(meReleaseRoutes)
  await fastify.register(publicProfileRoutes)
  await fastify.register(smartlinkRoutes)

  return fastify
}
