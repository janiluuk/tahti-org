// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import meSoundRoutes from '../routes/me/sound.js'
import meChannelVisualPresetsRoutes from '../routes/me/channel-visual-presets.js'
import meSoundBannerRoutes from '../routes/me/sound-banner.js'
import meProgrammeRoutes from '../routes/me/programme.js'
import meRadioSubmissionRoutes from '../routes/me/radio-submissions.js'
import meAnnouncementsRoutes from '../routes/me/announcements.js'
import adminAnnouncementsRoutes from '../routes/admin/announcements.js'
import meAddonsRoutes from '../routes/me/addons.js'
import meChannelBlockRoutes from '../routes/me/channel-blocks.js'
import adminAddonsRoutes from '../routes/admin/addons.js'
import addonStoreRoutes from '../routes/addons/store.js'
import addonPublicRoutes from '../routes/addons/public.js'
import internetRadioPresetsRoute from '../routes/internet-radio/presets.js'
import meInternetRadioRoutes from '../routes/me/internet-radio.js'
import adminInternetRadioRoutes from '../routes/admin/internet-radio.js'
import meThemesRoutes from '../routes/me/themes.js'
import adminThemesRoutes from '../routes/admin/themes.js'
import themeGalleryRoute from '../routes/themes/gallery.js'
import meIntegrationsRoutes from '../routes/me/integrations.js'
import lastfmIntegrationRoutes from '../routes/me/integrations-lastfm.js'
import adminNotificationsRoutes from '../routes/admin/notifications.js'
import meStorageRoutes from '../routes/me/storage.js'
import adminStorageRoutes from '../routes/admin/storage.js'
import meSoundStemsRoutes from '../routes/me/sound-stems.js'
import meSocialRoutes from '../routes/me/social.js'
import socialTwitterRoutes from '../routes/me/social-twitter.js'
import socialInstagramRoutes from '../routes/me/social-instagram.js'
import meChannelScheduleRoutes from '../routes/me/channel-schedule.js'
import meChannelProvisionRoutes from '../routes/me/channel-provision.js'
import meSoundVersionRoutes from '../routes/me/sound-versions.js'
import meSoundEditorRoutes from '../routes/me/sound-editor.js'
import meEditorProjectRoutes from '../routes/me/editor-projects.js'
import meDownloadGateStatsRoutes from '../routes/me/download-gate-stats.js'
import meChannelEgressRoutes from '../routes/me/channel-egress.js'
import meListenerGeoRoutes from '../routes/me/listener-geo.js'
import meChannelLiveStatsRoutes from '../routes/me/channel-live-stats.js'
import meChannelFunnelStatsRoutes from '../routes/me/channel-funnel-stats.js'
import meStatsRoutes from '../routes/me/stats.js'
import meEndBroadcastRoutes from '../routes/me/end-broadcast.js'
import meBroadcastRoutes from '../routes/me/broadcasts.js'
import meGoLiveRoutes from '../routes/me/go-live.js'
import meBroadcastPreflightRoutes from '../routes/me/broadcast-preflight.js'
import meGreenRoomDefaultsRoutes from '../routes/me/green-room-defaults.js'
import meGreenRoomRoutes from '../routes/me/green-room.js'
import meGreenRoomAccessRoutes from '../routes/me/green-room-access.js'
import meStashRoutes from '../routes/me/stash.js'
import meUsersRoutes from '../routes/me/users.js'

export async function registerStudioRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(meSoundRoutes)
  await fastify.register(meChannelVisualPresetsRoutes)
  await fastify.register(meSoundBannerRoutes)
  await fastify.register(meProgrammeRoutes)
  await fastify.register(meRadioSubmissionRoutes)
  await fastify.register(meAnnouncementsRoutes)
  await fastify.register(adminAnnouncementsRoutes)
  await fastify.register(meAddonsRoutes)
  await fastify.register(meChannelBlockRoutes)
  await fastify.register(adminAddonsRoutes)
  await fastify.register(addonStoreRoutes)
  await fastify.register(addonPublicRoutes)
  await fastify.register(internetRadioPresetsRoute)
  await fastify.register(meInternetRadioRoutes)
  await fastify.register(adminInternetRadioRoutes)
  await fastify.register(meThemesRoutes)
  await fastify.register(adminThemesRoutes)
  await fastify.register(themeGalleryRoute)
  await fastify.register(meIntegrationsRoutes)
  await fastify.register(lastfmIntegrationRoutes)
  await fastify.register(adminNotificationsRoutes)
  await fastify.register(meStorageRoutes)
  await fastify.register(adminStorageRoutes)
  await fastify.register(meSoundStemsRoutes)
  await fastify.register(meSocialRoutes)
  await fastify.register(socialTwitterRoutes)
  await fastify.register(socialInstagramRoutes)
  await fastify.register(meChannelScheduleRoutes)
  await fastify.register(meChannelProvisionRoutes)
  await fastify.register(meSoundVersionRoutes)
  await fastify.register(meSoundEditorRoutes)
  await fastify.register(meEditorProjectRoutes)
  await fastify.register(meDownloadGateStatsRoutes)
  await fastify.register(meChannelEgressRoutes)
  await fastify.register(meListenerGeoRoutes)
  await fastify.register(meChannelLiveStatsRoutes)
  await fastify.register(meChannelFunnelStatsRoutes)
  await fastify.register(meStatsRoutes)
  await fastify.register(meEndBroadcastRoutes)
  await fastify.register(meBroadcastRoutes)
  await fastify.register(meGoLiveRoutes)
  await fastify.register(meBroadcastPreflightRoutes)
  await fastify.register(meGreenRoomDefaultsRoutes)
  await fastify.register(meGreenRoomRoutes)
  await fastify.register(meGreenRoomAccessRoutes)
  await fastify.register(meStashRoutes)
  await fastify.register(meUsersRoutes)
}
