// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import adminMembersRoutes from '../routes/admin/members.js'
import adminStatsRoutes from '../routes/admin/stats.js'
import adminStreamsRoutes from '../routes/admin/streams.js'
import adminRadioRoutes from '../routes/admin/radio.js'
import adminRadioSubmissionRoutes from '../routes/admin/radio-submissions.js'
import adminTahtiSelectsRoutes from '../routes/admin/tahti-selects.js'
import adminNewsRoutes from '../routes/admin/news.js'
import adminChannelsRoutes from '../routes/admin/channels.js'
import adminSoundRoutes from '../routes/admin/sound.js'
import adminFilesRoutes from '../routes/admin/files.js'
import adminFanSubsRoutes from '../routes/admin/fansubs.js'
import adminUsersRoutes from '../routes/admin/users.js'
import adminEngagementRoutes from '../routes/admin/engagement.js'
import adminTopListsRoutes from '../routes/admin/top-lists.js'
import topListsRoutes from '../routes/top-lists/index.js'
import adminSupportRoutes from '../routes/admin/support.js'
import adminMissedLiveShowRoutes from '../routes/admin/missed-live-shows.js'
import adminAccountRestrictionRoutes from '../routes/admin/account-restrictions.js'
import adminResolutionsRoutes from '../routes/admin/resolutions.js'
import governanceRecordsRoutes from '../routes/admin/governance-records.js'
import adminReportsRoutes from '../routes/admin/reports.js'
import adminContentReportRoutes from '../routes/admin/content-reports.js'
import adminFeatureRequestRoutes from '../routes/admin/feature-requests.js'
import adminAuditRoutes from '../routes/admin/audit.js'
import adminLogsRoutes from '../routes/admin/logs.js'
import adminWorkersRoutes from '../routes/admin/workers.js'
import adminVenueRoutes from '../routes/admin/venues.js'
import adminBetaRoutes from '../routes/admin/beta.js'
import adminIntegrationsRoutes from '../routes/admin/integrations.js'
import adminDiscordBotRoutes from '../routes/admin/discord-bot.js'
import supportContactRoutes from '../routes/support/contact.js'
import contentReportsRoute from '../routes/reports/submit.js'
import betaApplyRoutes from '../routes/beta/apply.js'

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(adminMembersRoutes)
  await fastify.register(adminStatsRoutes)
  await fastify.register(adminStreamsRoutes)
  await fastify.register(adminRadioRoutes)
  await fastify.register(adminRadioSubmissionRoutes)
  await fastify.register(adminTahtiSelectsRoutes)
  await fastify.register(adminNewsRoutes)
  await fastify.register(adminChannelsRoutes)
  await fastify.register(adminSoundRoutes)
  await fastify.register(adminFilesRoutes)
  await fastify.register(adminFanSubsRoutes)
  await fastify.register(adminUsersRoutes)
  await fastify.register(adminEngagementRoutes)
  await fastify.register(adminTopListsRoutes)
  await fastify.register(topListsRoutes)
  await fastify.register(adminSupportRoutes)
  await fastify.register(adminMissedLiveShowRoutes)
  await fastify.register(adminAccountRestrictionRoutes)
  await fastify.register(adminResolutionsRoutes)
  await fastify.register(governanceRecordsRoutes)
  await fastify.register(adminReportsRoutes)
  await fastify.register(adminContentReportRoutes)
  await fastify.register(adminFeatureRequestRoutes)
  await fastify.register(adminAuditRoutes)
  await fastify.register(adminLogsRoutes)
  await fastify.register(adminWorkersRoutes)
  await fastify.register(adminVenueRoutes)
  await fastify.register(adminBetaRoutes)
  await fastify.register(adminIntegrationsRoutes)
  await fastify.register(adminDiscordBotRoutes)
  await fastify.register(supportContactRoutes)
  await fastify.register(contentReportsRoute)
  await fastify.register(betaApplyRoutes)
}
