// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import chatTokenRoute from '../routes/chat/token.js'
import chatViewerTokenRoute from '../routes/chat/viewer-token.js'
import chatFanTokenRoute from '../routes/chat/fan-token.js'
import chatAccessRoute from '../routes/chat/access.js'
import chatMessageRoute from '../routes/chat/message.js'
import chatAnnouncementsRoute from '../routes/chat/announcements.js'
import chatReactRoute from '../routes/chat/react.js'
import chatPresenceRoute from '../routes/chat/presence.js'
import chatHistoryRoute from '../routes/chat/history.js'
import meChat from '../routes/me/chat.js'
import meCommentSettings from '../routes/me/comment-settings.js'
import meTopListsSettings from '../routes/me/top-lists-settings.js'
import meRecordingSettings from '../routes/me/recording-settings.js'
import mePublishSettings from '../routes/me/publish-settings.js'
import commentsRoutes from '../routes/comments/index.js'
import trackReactionsRoutes from '../routes/reactions/track.js'
import meNotificationPreferencesRoutes from '../routes/me/notification-preferences.js'
import meModerators from '../routes/me/moderators.js'
import rtmpTargetRoutes from '../routes/me/rtmp-targets.js'
import apiTokenRoutes from '../routes/me/api-tokens.js'
import obsPresetRoutes from '../routes/me/obs-preset.js'

export async function registerChatRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(chatTokenRoute)
  await fastify.register(chatViewerTokenRoute)
  await fastify.register(chatFanTokenRoute)
  await fastify.register(chatAccessRoute)
  await fastify.register(chatMessageRoute)
  await fastify.register(chatAnnouncementsRoute)
  await fastify.register(chatReactRoute)
  await fastify.register(chatPresenceRoute)
  await fastify.register(chatHistoryRoute)
  await fastify.register(meChat)
  await fastify.register(meCommentSettings)
  await fastify.register(meTopListsSettings)
  await fastify.register(meRecordingSettings)
  await fastify.register(mePublishSettings)
  await fastify.register(commentsRoutes)
  await fastify.register(trackReactionsRoutes)
  await fastify.register(meNotificationPreferencesRoutes)
  await fastify.register(meModerators)
  await fastify.register(rtmpTargetRoutes)
  await fastify.register(rtmpTargetRoutes, { scope: 'radio' })
  await fastify.register(obsPresetRoutes)
  await fastify.register(apiTokenRoutes)
}
