// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import newsletterPublicRoutes from '../routes/newsletter/public.js'
import newsletterMeRoutes from '../routes/newsletter/me.js'
import mentionRoutes from '../routes/me/mentions.js'
import radioRoutes from '../routes/radio/index.js'
import venueRoutes from '../routes/venues/venues.js'
import meEventRoutes from '../routes/me/events.js'
import channelEventsRoute from '../routes/channels/events.js'
import mePostRoutes from '../routes/me/posts.js'
import channelPostsRoute from '../routes/channels/posts.js'
import meNotificationRoutes from '../routes/me/notifications.js'
import meFeedRoutes from '../routes/me/feed.js'
import meChannelMemberRoutes from '../routes/me/channel-members.js'
import channelMembersRoute from '../routes/channels/members.js'
import meTrackInsightsRoutes from '../routes/me/track-insights.js'
import meMessagesRoutes from '../routes/me/messages.js'
import meEmbedRoutes from '../routes/me/embeds.js'
import meRssFeedRoutes from '../routes/me/rss-feed.js'
import channelEmbedsRoute from '../routes/channels/embeds.js'

export async function registerCommunityRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(newsletterPublicRoutes)
  await fastify.register(newsletterMeRoutes)
  await fastify.register(mentionRoutes)
  await fastify.register(radioRoutes)
  await fastify.register(venueRoutes)
  await fastify.register(meEventRoutes)
  await fastify.register(channelEventsRoute)
  await fastify.register(mePostRoutes)
  await fastify.register(channelPostsRoute)
  await fastify.register(meNotificationRoutes)
  await fastify.register(meFeedRoutes)
  await fastify.register(meChannelMemberRoutes)
  await fastify.register(channelMembersRoute)
  await fastify.register(meTrackInsightsRoutes)
  await fastify.register(meMessagesRoutes)
  await fastify.register(meEmbedRoutes)
  await fastify.register(meRssFeedRoutes)
  await fastify.register(channelEmbedsRoute)
}
