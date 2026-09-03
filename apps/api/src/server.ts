// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import basicAuth from '@fastify/basic-auth'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import healthRoute from './routes/health.js'
import versionRoute from './routes/version.js'
import statusRoutes from './routes/status.js'
import metricsRoute from './routes/metrics.js'
import sourceRoute from './routes/source.js'
import publicApiDocsRoute from './routes/public-api-docs.js'
import registerRoute from './routes/auth/register.js'
import verifyRoute from './routes/auth/verify.js'
import usernameAvailableRoute from './routes/auth/username-available.js'
import loginRoute from './routes/auth/login.js'
import loginTotpRoute from './routes/auth/login-totp.js'
import logoutRoute from './routes/auth/logout.js'
import meRoute from './routes/auth/me.js'
import prepareUploadRoute from './routes/uploads/prepare.js'
import completeUploadRoute from './routes/uploads/complete.js'
import channelGetRoute from './routes/channels/get.js'
import channelSlugRedirectRoute from './routes/channels/slug-redirect.js'
import channelItemsRoute from './routes/channels/items.js'
import trackGetRoute from './routes/tracks/get.js'
import channelListRoute from './routes/channels/list.js'
import channelDirectoryRoute from './routes/channels/directory.js'
import tahtiSelectsGalleryRoute from './routes/channels/tahti-selects-gallery.js'
import latestTracksRoute from './routes/discover/latest-tracks.js'
import newToYouRoute from './routes/discover/new-to-you.js'
import searchRoute from './routes/discover/search.js'
import mcpRoute from './routes/mcp/index.js'
import jamRoute from './routes/jam/index.js'
import channelStatsRoute from './routes/channels/stats.js'
import newsPublicRoute from './routes/news/public.js'
import channelManageStatsRoute from './routes/channels/manage-stats.js'
import channelRtmpStatusRoute from './routes/channels/rtmp-status.js'
import channelTransportRoutes from './routes/channels/transport.js'
import channelFallbackCollectionRoutes from './routes/channels/fallback-collection.js'
import customDomainRoutes from './routes/channels/custom-domain.js'
import liveFingerprintsRoute from './routes/channels/live-fingerprints.js'
import itemReadyRoute from './routes/internal/item-ready.js'
import rtmpRoutes from './routes/internal/rtmp.js'
import icecastRoutes from './routes/internal/icecast.js'
import channelFallbackRoute from './routes/internal/channel-fallback.js'
import tlsAskRoute from './routes/internal/tls-ask.js'
import broadcastFingerprintInternalRoutes from './routes/internal/broadcast-fingerprint.js'
import internalRadioRoutes from './routes/internal/radio.js'
import internalDiscordBotRoutes from './routes/internal/discord-bot.js'
import streamSettingsRoutes from './routes/me/stream-settings.js'
import channelSlugRoutes from './routes/me/channel-slug.js'
import chatTokenRoute from './routes/chat/token.js'
import chatViewerTokenRoute from './routes/chat/viewer-token.js'
import chatFanTokenRoute from './routes/chat/fan-token.js'
import chatAccessRoute from './routes/chat/access.js'
import chatMessageRoute from './routes/chat/message.js'
import chatAnnouncementsRoute from './routes/chat/announcements.js'
import chatReactRoute from './routes/chat/react.js'
import chatPresenceRoute from './routes/chat/presence.js'
import chatHistoryRoute from './routes/chat/history.js'
import meChat from './routes/me/chat.js'
import meCommentSettings from './routes/me/comment-settings.js'
import meTopListsSettings from './routes/me/top-lists-settings.js'
import meRecordingSettings from './routes/me/recording-settings.js'
import mePublishSettings from './routes/me/publish-settings.js'
import commentsRoutes from './routes/comments/index.js'
import trackReactionsRoutes from './routes/reactions/track.js'
import meNotificationPreferencesRoutes from './routes/me/notification-preferences.js'
import meModerators from './routes/me/moderators.js'
import rtmpTargetRoutes from './routes/me/rtmp-targets.js'
import apiTokenRoutes from './routes/me/api-tokens.js'
import obsPresetRoutes from './routes/me/obs-preset.js'
import transparencyRoutes from './routes/transparency/index.js'
import adminLedgerRoutes from './routes/admin/ledger.js'
import governanceRoutes from './routes/governance/index.js'
import featureRequestsRoutes from './routes/governance/feature-requests.js'
import downloadRoutes from './routes/downloads/sound.js'
import artistFollowRoutes from './routes/engagement/artist-follows.js'
import soundRepostRoutes from './routes/engagement/sound-repost.js'
import soundLikeRoutes from './routes/engagement/sound-likes.js'
import soundRepostAckRoutes from './routes/engagement/sound-repost-ack.js'
import listenEventsRoutes from './routes/engagement/listen-events.js'
import listenHeartbeatRoutes from './routes/engagement/listen-heartbeat.js'
import meGrantsRoutes from './routes/me/grants.js'
import adminGrantsRoutes from './routes/admin/grants.js'
import fanTierRoutes from './routes/fansubs/tiers.js'
import fanSubscriptionRoutes from './routes/fansubs/subscriptions.js'
import fanConnectRoutes from './routes/fansubs/connect.js'
import fanSubPayoutRoutes from './routes/fansubs/payouts.js'
import purchaseTierRoutes from './routes/fansubs/purchase-tiers.js'
import stripeWebhookRoutes from './routes/webhooks/stripe.js'
import emailBounceWebhookRoutes from './routes/webhooks/email-bounce.js'
import membershipRoutes from './routes/me/membership.js'
import broadcastUsageRoutes from './routes/me/broadcast-usage.js'
import adminMembersRoutes from './routes/admin/members.js'
import adminStatsRoutes from './routes/admin/stats.js'
import adminStreamsRoutes from './routes/admin/streams.js'
import adminRadioRoutes from './routes/admin/radio.js'
import adminRadioSubmissionRoutes from './routes/admin/radio-submissions.js'
import adminTahtiSelectsRoutes from './routes/admin/tahti-selects.js'
import adminNewsRoutes from './routes/admin/news.js'
import adminChannelsRoutes from './routes/admin/channels.js'
import adminSoundRoutes from './routes/admin/sound.js'
import adminFilesRoutes from './routes/admin/files.js'
import adminFanSubsRoutes from './routes/admin/fansubs.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminEngagementRoutes from './routes/admin/engagement.js'
import adminTopListsRoutes from './routes/admin/top-lists.js'
import topListsRoutes from './routes/top-lists/index.js'
import adminSupportRoutes from './routes/admin/support.js'
import adminResolutionsRoutes from './routes/admin/resolutions.js'
import governanceRecordsRoutes from './routes/admin/governance-records.js'
import adminReportsRoutes from './routes/admin/reports.js'
import adminContentReportRoutes from './routes/admin/content-reports.js'
import adminFeatureRequestRoutes from './routes/admin/feature-requests.js'
import adminAuditRoutes from './routes/admin/audit.js'
import adminLogsRoutes from './routes/admin/logs.js'
import adminWorkersRoutes from './routes/admin/workers.js'
import adminVenueRoutes from './routes/admin/venues.js'
import adminMissedLiveShowRoutes from './routes/admin/missed-live-shows.js'
import adminAccountRestrictionRoutes from './routes/admin/account-restrictions.js'
import supportContactRoutes from './routes/support/contact.js'
import contentReportsRoute from './routes/reports/submit.js'
import adminBetaRoutes from './routes/admin/beta.js'
import adminIntegrationsRoutes from './routes/admin/integrations.js'
import adminDiscordBotRoutes from './routes/admin/discord-bot.js'
import betaApplyRoutes from './routes/beta/apply.js'
import setupPasswordRoute from './routes/auth/setup-password.js'
import resendVerificationRoute from './routes/auth/resend-verification.js'
import forgotPasswordRoute from './routes/auth/forgot-password.js'
import resetPasswordRoute from './routes/auth/reset-password.js'
import meReleaseRoutes from './routes/releases/me.js'
import releaseTrackRoutes from './routes/releases/tracks.js'
import releaseTrackVersionRoutes from './routes/releases/track-versions.js'
import releaseArtworkRoutes from './routes/releases/artwork.js'
import releaseDownloadRoutes from './routes/downloads/release.js'
import embedRoutes from './routes/releases/embed.js'
import publicProfileRoutes from './routes/profile/public.js'
import publicMentionRoutes from './routes/profile/mentions.js'
import smartlinkRoutes from './routes/releases/smartlink.js'
import smartlinkClickRoutes from './routes/releases/smartlink-click.js'
import latestReleasesRoutes from './routes/releases/latest.js'
import releaseAnalyticsRoutes from './routes/releases/analytics.js'
import sitemapRoutes from './routes/sitemap.js'
import ogRoutes from './routes/og.js'
import mixcloudRoutes from './routes/me/mixcloud.js'
import bandcampRoutes from './routes/me/bandcamp.js'
import soundcloudRoutes from './routes/me/soundcloud.js'
import googleDriveRoutes from './routes/me/google-drive.js'
import meImportPluginRoutes from './routes/me/import-plugins.js'
import musicbrainzRoutes from './routes/me/musicbrainz.js'
import spotifyImportRoutes from './routes/imports/spotify.js'
import spotifyProfileRoute from './routes/me/spotify-profile.js'
import mixcloudEmbedImportRoutes from './routes/imports/mixcloud-embed.js'
import hearthisImportRoutes from './routes/imports/hearthis.js'
import revelatorRoutes from './routes/me/revelator.js'
import newsletterPublicRoutes from './routes/newsletter/public.js'
import newsletterMeRoutes from './routes/newsletter/me.js'
import venueRoutes from './routes/venues/venues.js'
import meEventRoutes from './routes/me/events.js'
import channelEventsRoute from './routes/channels/events.js'
import mePostRoutes from './routes/me/posts.js'
import channelPostsRoute from './routes/channels/posts.js'
import meNotificationRoutes from './routes/me/notifications.js'
import meFeedRoutes from './routes/me/feed.js'
import meChannelMemberRoutes from './routes/me/channel-members.js'
import channelMembersRoute from './routes/channels/members.js'
import meTrackInsightsRoutes from './routes/me/track-insights.js'
import meMessagesRoutes from './routes/me/messages.js'
import meEmbedRoutes from './routes/me/embeds.js'
import meRssFeedRoutes from './routes/me/rss-feed.js'
import channelEmbedsRoute from './routes/channels/embeds.js'
import radioRoutes from './routes/radio/index.js'
import mentionRoutes from './routes/me/mentions.js'
import meProfileRoutes from './routes/me/profile.js'
import meTotpRoutes from './routes/me/totp.js'
import meAvatarRoutes from './routes/me/avatar.js'
import meChannelBackdropRoutes from './routes/me/channel-backdrop.js'
import meMediaRoutes from './routes/me/media.js'
import mePrivacyRoutes, { publicPressKitRoutes } from './routes/me/privacy.js'
import mePressKitImages from './routes/me/press-kit-images.js'
import meRadioSlotBookings from './routes/me/radio-slot-bookings.js'
import meSoundRoutes from './routes/me/sound.js'
import meChannelVisualPresetsRoutes from './routes/me/channel-visual-presets.js'
import meSoundBannerRoutes from './routes/me/sound-banner.js'
import meProgrammeRoutes from './routes/me/programme.js'
import meRadioSubmissionRoutes from './routes/me/radio-submissions.js'
import meAnnouncementsRoutes from './routes/me/announcements.js'
import adminAnnouncementsRoutes from './routes/admin/announcements.js'
import meAddonsRoutes from './routes/me/addons.js'
import adminAddonsRoutes from './routes/admin/addons.js'
import addonStoreRoutes from './routes/addons/store.js'
import addonPublicRoutes from './routes/addons/public.js'
import internetRadioPresetsRoute from './routes/internet-radio/presets.js'
import meInternetRadioRoutes from './routes/me/internet-radio.js'
import adminInternetRadioRoutes from './routes/admin/internet-radio.js'
import meThemesRoutes from './routes/me/themes.js'
import adminThemesRoutes from './routes/admin/themes.js'
import themeGalleryRoute from './routes/themes/gallery.js'
import meIntegrationsRoutes from './routes/me/integrations.js'
import adminNotificationsRoutes from './routes/admin/notifications.js'
import meStorageRoutes from './routes/me/storage.js'
import adminStorageRoutes from './routes/admin/storage.js'
import meSoundStemsRoutes from './routes/me/sound-stems.js'
import meSocialRoutes from './routes/me/social.js'
import socialTwitterRoutes from './routes/me/social-twitter.js'
import socialInstagramRoutes from './routes/me/social-instagram.js'
import meChannelScheduleRoutes from './routes/me/channel-schedule.js'
import meChannelProvisionRoutes from './routes/me/channel-provision.js'
import meSoundVersionRoutes from './routes/me/sound-versions.js'
import meSoundEditorRoutes from './routes/me/sound-editor.js'
import meEditorProjectRoutes from './routes/me/editor-projects.js'
import meDownloadGateStatsRoutes from './routes/me/download-gate-stats.js'
import meChannelEgressRoutes from './routes/me/channel-egress.js'
import meListenerGeoRoutes from './routes/me/listener-geo.js'
import meChannelLiveStatsRoutes from './routes/me/channel-live-stats.js'
import meChannelFunnelStatsRoutes from './routes/me/channel-funnel-stats.js'
import meStatsRoutes from './routes/me/stats.js'
import meEndBroadcastRoutes from './routes/me/end-broadcast.js'
import meBroadcastRoutes from './routes/me/broadcasts.js'
import meGoLiveRoutes from './routes/me/go-live.js'
import meBroadcastPreflightRoutes from './routes/me/broadcast-preflight.js'
import meGreenRoomDefaultsRoutes from './routes/me/green-room-defaults.js'
import meGreenRoomRoutes from './routes/me/green-room.js'
import meGreenRoomAccessRoutes from './routes/me/green-room-access.js'
import meStashRoutes from './routes/me/stash.js'
import meUsersRoutes from './routes/me/users.js'
import collectionRoutes from './routes/collections/collections.js'
import collectionCoverRoutes from './routes/collections/cover.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import requestLogPlugin from './plugins/request-log.js'
import corsPlugin from './plugins/cors.js'
import { apiLoggerConfig } from './lib/logger.js'
import { config } from './config.js'
import {
  ApiStatusResponseSchema,
  AuthLoginResponseSchema,
  AuthMessageResponseSchema,
  AuthRegisterResponseSchema,
  BillingPortalUrlResponseSchema,
  BroadcastUsageResponseSchema,
  ChannelEmbedViewSchema,
  ChannelProgrammeViewSchema,
  ChatAnnouncementListSchema,
  ChatOkResponseSchema,
  ChatPresenceResponseSchema,
  ChatTokenOnlyResponseSchema,
  ChatTokenResponseSchema,
  ChannelEgressResponseSchema,
  ChannelFunnelResponseSchema,
  ChannelLiveStatsResponseSchema,
  ChannelScheduleViewSchema,
  SoundListSchema,
  AuthMeResponseSchema,
  ChannelSoundsResponseSchema,
  CollectionPublicViewSchema,
  CompleteUploadResponseSchema,
  DownloadGateItemDetailResponseSchema,
  DownloadGateStatsResponseSchema,
  DownloadGateStatusSchema,
  DownloadUrlResponseSchema,
  FanConnectOnboardResponseSchema,
  FanConnectStatusResponseSchema,
  FanSubActivatedResponseSchema,
  FanSubCancelResponseSchema,
  FanSubCheckoutUrlResponseSchema,
  FanSubSubscriptionListSchema,
  FanSubPayoutsDashboardSchema,
  FanTiersPublicResponseSchema,
  HealthResponseSchema,
  IcecastPassRotateResponseSchema,
  EmbedTrackPlaySchema,
  MembershipCheckoutResponseSchema,
  MembershipStatusResponseSchema,
  GovernanceMemberListSchema,
  GrantPreviewResponseSchema,
  LedgerEntryCreatedSchema,
  LedgerEntryListSchema,
  MeGrantListSchema,
  MeReleaseDetailSchema,
  MeReleaseListSchema,
  MotionDetailSchema,
  MotionRefResponseSchema,
  MetaStreamOptResponseSchema,
  MotionListSchema,
  OEmbedResponseSchema,
  NewsletterDraftListSchema,
  NewsletterDraftViewSchema,
  NewsletterSubscriberStatsSchema,
  NewsletterSubscribeStatusSchema,
  PrepareUploadResponseSchema,
  ProfileFieldsSchema,
  PublicProfileViewSchema,
  RadioNowPlayingSchema,
  ReleaseCatalogViewSchema,
  ReleaseEmbedViewSchema,
  RepostAckResponseSchema,
  RtmpStreamKeyRevealSchema,
  RtmpTargetListSchema,
  RtmpTargetViewSchema,
  ApiTokenListSchema,
  ApiTokenCreatedSchema,
  AdminDiscordBotSettingsSchema,
  UpdateDiscordBotSettingsSchema,
  InternalDiscordBotCredentialsSchema,
  SmartLinkViewSchema,
  StreamKeyRotateResponseSchema,
  StreamSettingsResponseSchema,
  TransparencyCategoriesResponseSchema,
  TransparencyGrantReportSchema,
  TransparencyMonthlyRollupListSchema,
  TransparencyYtdResponseSchema,
  PublicChannelViewSchema,
  VenueBroadcastCalendarSchema,
  VenueDirectoryListSchema,
  VenuePublicProfileSchema,
  VoteCastResponseSchema,
  zodOpenApiComponents,
} from '@tahti/shared'

export interface BuildOptions {
  logger?: boolean | object
}

export async function buildApp(opts: BuildOptions = {}) {
  const fastify = Fastify({
    logger: apiLoggerConfig(opts.logger),
    trustProxy: true,
  })

  // Browser CORS — must be registered before routes so it also covers
  // OPTIONS preflights for paths with no explicit OPTIONS handler.
  await fastify.register(corsPlugin)

  // SEC-001: ingest + internal callbacks must not be reachable from the public internet.
  // SEC-007: /api/chat/message is Centrifugo's publish-proxy webhook (infra/centrifugo.json
  // "publish_proxy_name": "chat_publish") — Centrifugo always calls it over the internal Docker
  // network, so it belongs in the same trust boundary as /internal/* even though its path
  // doesn't start with that prefix. Previously reachable by anyone who could reach the API.
  fastify.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0] ?? ''
    if (!path.startsWith('/internal/') && path !== '/api/chat/message') return
    const { isTrustedInternalRequest } = await import('./lib/internal-request.js')
    if (!isTrustedInternalRequest(request)) {
      return reply.status(403).send('forbidden')
    }
  })

  // OpenAPI / Swagger (versioned; built on every startup, served at /docs)
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Tahti API',
        version: '1',
        description:
          'Tahti ry broadcasting platform API. AGPL-3.0 licensed. Source: https://github.com/tahtiapp/tahti. Public docs: GET / (Scalar) · GET /api/openapi.json',
        contact: { name: 'Tahti ry', url: 'https://tahti.live' },
        license: { name: 'AGPL-3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
      },
      servers: [
        { url: config.apiUrl, description: 'This environment' },
        { url: 'https://api.tahti.live', description: 'Production' },
        { url: 'http://localhost:3001', description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          sessionCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: config.sessionCookieName,
            description: 'Session cookie issued by POST /api/auth/login',
          },
          apiToken: {
            type: 'http',
            scheme: 'bearer',
            description:
              'Personal API token, generated at /dashboard/settings/api (POST /api/me/api-tokens). Read-only tokens may only call GET/HEAD/OPTIONS.',
          },
        },
        schemas: zodOpenApiComponents({
          ChannelEgress: ChannelEgressResponseSchema,
          ChannelLiveStats: ChannelLiveStatsResponseSchema,
          ChannelFunnel: ChannelFunnelResponseSchema,
          DownloadGateStats: DownloadGateStatsResponseSchema,
          DownloadGateItemDetail: DownloadGateItemDetailResponseSchema,
          DownloadUrl: DownloadUrlResponseSchema,
          DownloadGateStatus: DownloadGateStatusSchema,
          TransparencyYtd: TransparencyYtdResponseSchema,
          TransparencyGrantReport: TransparencyGrantReportSchema,
          TransparencyMonthlyRollupList: TransparencyMonthlyRollupListSchema,
          TransparencyCategories: TransparencyCategoriesResponseSchema,
          ChannelSchedule: ChannelScheduleViewSchema,
          GrantPreview: GrantPreviewResponseSchema,
          BroadcastUsage: BroadcastUsageResponseSchema,
          PublicChannel: PublicChannelViewSchema,
          PublicProfile: PublicProfileViewSchema,
          SmartLink: SmartLinkViewSchema,
          FanTiersPublic: FanTiersPublicResponseSchema,
          GovernanceMembers: GovernanceMemberListSchema,
          MotionList: MotionListSchema,
          MotionDetail: MotionDetailSchema,
          CollectionPublic: CollectionPublicViewSchema,
          SoundList: SoundListSchema,
          ChannelSounds: ChannelSoundsResponseSchema,
          AuthMe: AuthMeResponseSchema,
          PrepareUpload: PrepareUploadResponseSchema,
          CompleteUpload: CompleteUploadResponseSchema,
          ProfileFields: ProfileFieldsSchema,
          MetaStreamOpt: MetaStreamOptResponseSchema,
          NewsletterSubscriberStats: NewsletterSubscriberStatsSchema,
          NewsletterSubscribeStatus: NewsletterSubscribeStatusSchema,
          NewsletterDraftList: NewsletterDraftListSchema,
          NewsletterDraft: NewsletterDraftViewSchema,
          RepostAck: RepostAckResponseSchema,
          ApiStatus: ApiStatusResponseSchema,
          RadioNowPlaying: RadioNowPlayingSchema,
          ChannelProgramme: ChannelProgrammeViewSchema,
          StreamSettings: StreamSettingsResponseSchema,
          StreamKeyRotate: StreamKeyRotateResponseSchema,
          IcecastPassRotate: IcecastPassRotateResponseSchema,
          MembershipStatus: MembershipStatusResponseSchema,
          MembershipCheckout: MembershipCheckoutResponseSchema,
          BillingPortalUrl: BillingPortalUrlResponseSchema,
          FanSubCheckoutUrl: FanSubCheckoutUrlResponseSchema,
          FanSubActivated: FanSubActivatedResponseSchema,
          FanSubSubscriptionList: FanSubSubscriptionListSchema,
          FanSubCancel: FanSubCancelResponseSchema,
          FanConnectStatus: FanConnectStatusResponseSchema,
          FanConnectOnboard: FanConnectOnboardResponseSchema,
          VenueDirectoryList: VenueDirectoryListSchema,
          VenuePublicProfile: VenuePublicProfileSchema,
          VenueBroadcastCalendar: VenueBroadcastCalendarSchema,
          AuthLogin: AuthLoginResponseSchema,
          AuthRegister: AuthRegisterResponseSchema,
          AuthMessage: AuthMessageResponseSchema,
          Health: HealthResponseSchema,
          ChatToken: ChatTokenResponseSchema,
          ChatTokenOnly: ChatTokenOnlyResponseSchema,
          ChatOk: ChatOkResponseSchema,
          ChatPresence: ChatPresenceResponseSchema,
          ChatAnnouncementList: ChatAnnouncementListSchema,
          MotionRef: MotionRefResponseSchema,
          VoteCast: VoteCastResponseSchema,
          LedgerEntryCreated: LedgerEntryCreatedSchema,
          LedgerEntryList: LedgerEntryListSchema,
          MeReleaseList: MeReleaseListSchema,
          MeReleaseDetail: MeReleaseDetailSchema,
          ReleaseCatalog: ReleaseCatalogViewSchema,
          RtmpTargetList: RtmpTargetListSchema,
          RtmpTarget: RtmpTargetViewSchema,
          RtmpStreamKeyReveal: RtmpStreamKeyRevealSchema,
          FanSubPayoutsDashboard: FanSubPayoutsDashboardSchema,
          MeGrantList: MeGrantListSchema,
          OEmbed: OEmbedResponseSchema,
          ReleaseEmbed: ReleaseEmbedViewSchema,
          ChannelEmbed: ChannelEmbedViewSchema,
          EmbedTrackPlay: EmbedTrackPlaySchema,
          ApiTokenList: ApiTokenListSchema,
          ApiTokenCreated: ApiTokenCreatedSchema,
          AdminDiscordBotSettings: AdminDiscordBotSettingsSchema,
          UpdateDiscordBotSettings: UpdateDiscordBotSettingsSchema,
          InternalDiscordBotCredentials: InternalDiscordBotCredentialsSchema,
        }),
      },
      tags: [
        { name: 'auth', description: 'Authentication and session management' },
        { name: 'channel', description: 'Channel + sound management' },
        { name: 'chat', description: 'Live chat (Centrifugo)' },
        { name: 'releases', description: 'Release catalogue and smart links' },
        { name: 'downloads', description: 'Public downloads with anti-fraud' },
        { name: 'newsletter', description: 'Fan newsletter system' },
        { name: 'fansubs', description: 'Fan-to-artist subscriptions' },
        { name: 'governance', description: 'Member governance and motions' },
        { name: 'transparency', description: 'Public transparency ledger' },
        { name: 'venues', description: 'Venue directory and iCalendar feeds' },
        { name: 'radio', description: 'Tahti Radio meta-stream' },
        { name: 'settings', description: 'Account settings, incl. personal API tokens' },
        { name: 'admin', description: 'Board / admin endpoints' },
      ],
    },
  })

  // Swagger UI with HTTP Basic Auth guard (ops-only)
  await fastify.register(basicAuth, {
    validate(username, password, _req, _reply, done) {
      if (username === config.swagger.docsUser && password === config.swagger.docsPass)
        return done()
      return done(new Error('Unauthorized'))
    },
    authenticate: { realm: 'Tahti API docs' },
  })

  // Guard /docs/* before registering swagger-ui so its routes inherit the hook
  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/docs')) return
    await new Promise<void>((resolve, reject) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fastify.basicAuth as any)(request, reply, (err?: Error) => (err ? reject(err) : resolve())),
    )
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    transformSpecificationClone: true,
    logLevel: 'warn',
  })

  // Plugins
  await fastify.register(cookie)
  await fastify.register(formbody)
  await fastify.register(sensible)
  await fastify.register(requestLogPlugin)
  await fastify.register(dbPlugin)
  await fastify.register(authPlugin)
  await fastify.register(rateLimitPlugin)

  // Add Source-Code header for AGPL §13 compliance
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Source-Code', config.sourceRepoUrl)
  })

  // Routes
  await fastify.register(healthRoute)
  await fastify.register(versionRoute)
  await fastify.register(statusRoutes)
  await fastify.register(metricsRoute)
  await fastify.register(sourceRoute)
  await fastify.register(publicApiDocsRoute)
  await fastify.register(registerRoute)
  await fastify.register(verifyRoute)
  await fastify.register(usernameAvailableRoute)
  await fastify.register(setupPasswordRoute)
  await fastify.register(resendVerificationRoute)
  await fastify.register(forgotPasswordRoute)
  await fastify.register(resetPasswordRoute)
  await fastify.register(loginRoute)
  await fastify.register(loginTotpRoute)
  await fastify.register(logoutRoute)
  await fastify.register(meRoute)
  await fastify.register(prepareUploadRoute)
  await fastify.register(completeUploadRoute)
  await fastify.register(channelGetRoute)
  await fastify.register(channelSlugRedirectRoute)
  await fastify.register(channelListRoute)
  await fastify.register(channelDirectoryRoute)
  await fastify.register(tahtiSelectsGalleryRoute)
  await fastify.register(newToYouRoute)
  await fastify.register(latestTracksRoute)
  await fastify.register(searchRoute)
  await fastify.register(mcpRoute)
  await fastify.register(jamRoute)
  await fastify.register(channelStatsRoute)
  await fastify.register(newsPublicRoute)
  await fastify.register(channelManageStatsRoute)
  await fastify.register(channelRtmpStatusRoute)
  await fastify.register(channelTransportRoutes)
  await fastify.register(channelFallbackCollectionRoutes)
  await fastify.register(customDomainRoutes)
  await fastify.register(channelItemsRoute)
  await fastify.register(trackGetRoute)
  await fastify.register(liveFingerprintsRoute)
  await fastify.register(itemReadyRoute)

  // M3: live ingest webhooks + stream settings
  await fastify.register(rtmpRoutes)
  await fastify.register(icecastRoutes)
  await fastify.register(channelFallbackRoute)
  await fastify.register(tlsAskRoute)
  await fastify.register(broadcastFingerprintInternalRoutes)
  await fastify.register(internalRadioRoutes)
  await fastify.register(internalDiscordBotRoutes)
  await fastify.register(streamSettingsRoutes)
  await fastify.register(channelSlugRoutes)

  // M5: chat
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

  // M6: RTMP multistream targets
  await fastify.register(rtmpTargetRoutes)
  await fastify.register(obsPresetRoutes)

  // Personal API tokens (Bearer auth for third-party / scripted access)
  await fastify.register(apiTokenRoutes)

  // M8: transparency ledger
  await fastify.register(transparencyRoutes)
  await fastify.register(adminLedgerRoutes)

  // M10: member governance (motions + advisory voting)
  await fastify.register(governanceRoutes)
  await fastify.register(featureRequestsRoutes)

  // M18: downloads as first-class action (engagement units)
  await fastify.register(downloadRoutes)
  await fastify.register(artistFollowRoutes)
  await fastify.register(soundRepostRoutes)
  await fastify.register(soundLikeRoutes)
  await fastify.register(listenEventsRoutes)
  await fastify.register(listenHeartbeatRoutes)
  await fastify.register(soundRepostAckRoutes)

  // M9: annual grant disbursements
  await fastify.register(meGrantsRoutes)
  await fastify.register(adminGrantsRoutes)

  // M19: fan-to-artist subscriptions
  await fastify.register(fanTierRoutes)
  await fastify.register(fanSubscriptionRoutes)
  await fastify.register(purchaseTierRoutes)
  await fastify.register(fanConnectRoutes)
  await fastify.register(fanSubPayoutRoutes)
  await fastify.register(stripeWebhookRoutes)
  await fastify.register(emailBounceWebhookRoutes)

  // M1: annual membership payment
  await fastify.register(membershipRoutes)
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

  // M20: tier gating
  await fastify.register(broadcastUsageRoutes)

  // M11: audit exports
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

  // M12: artist profile + releases + audio upload pipeline
  await fastify.register(meReleaseRoutes)
  await fastify.register(releaseTrackRoutes)
  await fastify.register(releaseTrackVersionRoutes)
  await fastify.register(releaseArtworkRoutes)
  await fastify.register(publicProfileRoutes)
  await fastify.register(publicMentionRoutes)
  await fastify.register(smartlinkRoutes)
  await fastify.register(smartlinkClickRoutes)
  await fastify.register(latestReleasesRoutes)
  await fastify.register(releaseAnalyticsRoutes)
  await fastify.register(sitemapRoutes)
  await fastify.register(ogRoutes)

  // M12 / M15: profile update (bio, social links) + mention detection
  await fastify.register(meProfileRoutes)
  await fastify.register(meTotpRoutes)
  await fastify.register(meAvatarRoutes)
  await fastify.register(meMediaRoutes)
  await fastify.register(meChannelBackdropRoutes)
  await fastify.register(mePrivacyRoutes)
  await fastify.register(mePressKitImages)
  await fastify.register(publicPressKitRoutes)
  await fastify.register(meRadioSlotBookings)

  // M14: embed widget + oEmbed
  await fastify.register(embedRoutes)

  // M7: Mixcloud upload for sound items
  await fastify.register(mixcloudRoutes)
  await fastify.register(bandcampRoutes)
  await fastify.register(soundcloudRoutes)
  await fastify.register(googleDriveRoutes)
  await fastify.register(meImportPluginRoutes)
  await fastify.register(musicbrainzRoutes)
  await fastify.register(spotifyImportRoutes)
  await fastify.register(spotifyProfileRoute)
  await fastify.register(mixcloudEmbedImportRoutes)
  await fastify.register(hearthisImportRoutes)
  await fastify.register(revelatorRoutes)

  // M13: newsletter (public + artist-facing)
  await fastify.register(newsletterPublicRoutes)
  await fastify.register(newsletterMeRoutes)

  // M15: artist @-mention preferences + mute management
  await fastify.register(mentionRoutes)

  // M16: Tahti Radio now-playing
  await fastify.register(radioRoutes)

  // M17: venue directory + iCalendar feeds
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

  // M18: public release-track downloads with anti-fraud
  await fastify.register(releaseDownloadRoutes)

  // M22/M24/M25: sound item metadata edit + channel slideshow
  await fastify.register(meSoundRoutes)
  await fastify.register(meChannelVisualPresetsRoutes)
  await fastify.register(meSoundBannerRoutes)
  await fastify.register(meProgrammeRoutes)
  await fastify.register(meRadioSubmissionRoutes)
  await fastify.register(meAnnouncementsRoutes)
  await fastify.register(adminAnnouncementsRoutes)
  await fastify.register(meAddonsRoutes)
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

  // M23: collections + RSS feeds
  await fastify.register(collectionRoutes)
  await fastify.register(collectionCoverRoutes)

  return fastify
}
