// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import transparencyRoutes from '../routes/transparency/index.js'
import adminLedgerRoutes from '../routes/admin/ledger.js'
import governanceRoutes from '../routes/governance/index.js'
import featureRequestsRoutes from '../routes/governance/feature-requests.js'
import downloadRoutes from '../routes/downloads/sound.js'
import artistFollowRoutes from '../routes/engagement/artist-follows.js'
import soundRepostRoutes from '../routes/engagement/sound-repost.js'
import soundLikeRoutes from '../routes/engagement/sound-likes.js'
import soundRepostAckRoutes from '../routes/engagement/sound-repost-ack.js'
import listenEventsRoutes from '../routes/engagement/listen-events.js'
import listenHeartbeatRoutes from '../routes/engagement/listen-heartbeat.js'
import meGrantsRoutes from '../routes/me/grants.js'
import adminGrantsRoutes from '../routes/admin/grants.js'
import fanTierRoutes from '../routes/fansubs/tiers.js'
import fanSubscriptionRoutes from '../routes/fansubs/subscriptions.js'
import fanConnectRoutes from '../routes/fansubs/connect.js'
import fanSubPayoutRoutes from '../routes/fansubs/payouts.js'
import purchaseTierRoutes from '../routes/fansubs/purchase-tiers.js'
import stripeWebhookRoutes from '../routes/webhooks/stripe.js'
import emailBounceWebhookRoutes from '../routes/webhooks/email-bounce.js'
import exportWebhookRoutes from '../routes/webhooks/export.js'
import membershipRoutes from '../routes/me/membership.js'
import broadcastUsageRoutes from '../routes/me/broadcast-usage.js'

export async function registerMoneyRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(transparencyRoutes)
  await fastify.register(adminLedgerRoutes)
  await fastify.register(governanceRoutes)
  await fastify.register(featureRequestsRoutes)
  await fastify.register(downloadRoutes)
  await fastify.register(artistFollowRoutes)
  await fastify.register(soundRepostRoutes)
  await fastify.register(soundLikeRoutes)
  await fastify.register(listenEventsRoutes)
  await fastify.register(listenHeartbeatRoutes)
  await fastify.register(soundRepostAckRoutes)
  await fastify.register(meGrantsRoutes)
  await fastify.register(adminGrantsRoutes)
  await fastify.register(fanTierRoutes)
  await fastify.register(fanSubscriptionRoutes)
  await fastify.register(purchaseTierRoutes)
  await fastify.register(fanConnectRoutes)
  await fastify.register(fanSubPayoutRoutes)
  await fastify.register(stripeWebhookRoutes)
  await fastify.register(emailBounceWebhookRoutes)
  await fastify.register(exportWebhookRoutes)
  await fastify.register(membershipRoutes)
  await fastify.register(broadcastUsageRoutes)
}
