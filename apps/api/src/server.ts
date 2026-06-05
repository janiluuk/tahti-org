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
import statusRoutes from './routes/status.js'
import metricsRoute from './routes/metrics.js'
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
import channelListRoute from './routes/channels/list.js'
import liveFingerprintsRoute from './routes/channels/live-fingerprints.js'
import itemReadyRoute from './routes/internal/item-ready.js'
import rtmpRoutes from './routes/internal/rtmp.js'
import icecastRoutes from './routes/internal/icecast.js'
import channelFallbackRoute from './routes/internal/channel-fallback.js'
import broadcastFingerprintInternalRoutes from './routes/internal/broadcast-fingerprint.js'
import internalRadioRoutes from './routes/internal/radio.js'
import streamSettingsRoutes from './routes/me/stream-settings.js'
import chatTokenRoute from './routes/chat/token.js'
import chatFanTokenRoute from './routes/chat/fan-token.js'
import chatAccessRoute from './routes/chat/access.js'
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
import artistFollowRoutes from './routes/engagement/artist-follows.js'
import archiveRepostRoutes from './routes/engagement/archive-repost.js'
import meGrantsRoutes from './routes/me/grants.js'
import adminGrantsRoutes from './routes/admin/grants.js'
import fanTierRoutes from './routes/fansubs/tiers.js'
import fanSubscriptionRoutes from './routes/fansubs/subscriptions.js'
import fanConnectRoutes from './routes/fansubs/connect.js'
import fanSubPayoutRoutes from './routes/fansubs/payouts.js'
import stripeWebhookRoutes from './routes/webhooks/stripe.js'
import emailBounceWebhookRoutes from './routes/webhooks/email-bounce.js'
import membershipRoutes from './routes/me/membership.js'
import broadcastUsageRoutes from './routes/me/broadcast-usage.js'
import adminMembersRoutes from './routes/admin/members.js'
import adminStatsRoutes from './routes/admin/stats.js'
import adminStreamsRoutes from './routes/admin/streams.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminAuditRoutes from './routes/admin/audit.js'
import adminVenueRoutes from './routes/admin/venues.js'
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
import releaseAnalyticsRoutes from './routes/releases/analytics.js'
import sitemapRoutes from './routes/sitemap.js'
import mixcloudRoutes from './routes/me/mixcloud.js'
import revelatorRoutes from './routes/me/revelator.js'
import newsletterPublicRoutes from './routes/newsletter/public.js'
import newsletterMeRoutes from './routes/newsletter/me.js'
import venueRoutes from './routes/venues/venues.js'
import radioRoutes from './routes/radio/index.js'
import mentionRoutes from './routes/me/mentions.js'
import meProfileRoutes from './routes/me/profile.js'
import meArchiveRoutes from './routes/me/archive.js'
import meProgrammeRoutes from './routes/me/programme.js'
import meChannelScheduleRoutes from './routes/me/channel-schedule.js'
import meArchiveVersionRoutes from './routes/me/archive-versions.js'
import meDownloadGateStatsRoutes from './routes/me/download-gate-stats.js'
import meChannelEgressRoutes from './routes/me/channel-egress.js'
import meChannelLiveStatsRoutes from './routes/me/channel-live-stats.js'
import meChannelFunnelStatsRoutes from './routes/me/channel-funnel-stats.js'
import meUsersRoutes from './routes/me/users.js'
import collectionRoutes from './routes/collections/collections.js'
import rateLimitPlugin from './plugins/rate-limit.js'
import requestLogPlugin from './plugins/request-log.js'
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
  ArchiveItemListSchema,
  AuthMeResponseSchema,
  ChannelArchiveItemsResponseSchema,
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

  // OpenAPI / Swagger (versioned; built on every startup, served at /docs)
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Tahti API',
        version: '1',
        description:
          'Tahti ry broadcasting platform API. AGPL-3.0 licensed. Source: https://github.com/tahtiapp/tahti',
        contact: { name: 'Tahti ry', url: 'https://tahti.live' },
        license: { name: 'AGPL-3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
      },
      components: {
        securitySchemes: {
          sessionCookie: {
            type: 'apiKey',
            in: 'cookie',
            name: config.sessionCookieName,
            description: 'Session cookie issued by POST /api/auth/login',
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
          ArchiveItemList: ArchiveItemListSchema,
          ChannelArchiveItems: ChannelArchiveItemsResponseSchema,
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
        }),
      },
      tags: [
        { name: 'auth', description: 'Authentication and session management' },
        { name: 'channel', description: 'Channel + archive management' },
        { name: 'chat', description: 'Live chat (Centrifugo)' },
        { name: 'releases', description: 'Release catalogue and smart links' },
        { name: 'downloads', description: 'Public downloads with anti-fraud' },
        { name: 'newsletter', description: 'Fan newsletter system' },
        { name: 'fansubs', description: 'Fan-to-artist subscriptions' },
        { name: 'governance', description: 'Member governance and motions' },
        { name: 'transparency', description: 'Public transparency ledger' },
        { name: 'venues', description: 'Venue directory and iCalendar feeds' },
        { name: 'radio', description: 'Tahti Radio meta-stream' },
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
  await fastify.register(statusRoutes)
  await fastify.register(metricsRoute)
  await fastify.register(sourceRoute)
  await fastify.register(registerRoute)
  await fastify.register(verifyRoute)
  await fastify.register(loginRoute)
  await fastify.register(logoutRoute)
  await fastify.register(meRoute)
  await fastify.register(prepareUploadRoute)
  await fastify.register(completeUploadRoute)
  await fastify.register(channelGetRoute)
  await fastify.register(channelListRoute)
  await fastify.register(channelItemsRoute)
  await fastify.register(liveFingerprintsRoute)
  await fastify.register(itemReadyRoute)

  // M3: live ingest webhooks + stream settings
  await fastify.register(rtmpRoutes)
  await fastify.register(icecastRoutes)
  await fastify.register(channelFallbackRoute)
  await fastify.register(broadcastFingerprintInternalRoutes)
  await fastify.register(internalRadioRoutes)
  await fastify.register(streamSettingsRoutes)

  // M5: chat
  await fastify.register(chatTokenRoute)
  await fastify.register(chatFanTokenRoute)
  await fastify.register(chatAccessRoute)
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
  await fastify.register(artistFollowRoutes)
  await fastify.register(archiveRepostRoutes)

  // M9: annual grant disbursements
  await fastify.register(meGrantsRoutes)
  await fastify.register(adminGrantsRoutes)

  // M19: fan-to-artist subscriptions
  await fastify.register(fanTierRoutes)
  await fastify.register(fanSubscriptionRoutes)
  await fastify.register(fanConnectRoutes)
  await fastify.register(fanSubPayoutRoutes)
  await fastify.register(stripeWebhookRoutes)
  await fastify.register(emailBounceWebhookRoutes)

  // M1: annual membership payment
  await fastify.register(membershipRoutes)
  await fastify.register(adminMembersRoutes)
  await fastify.register(adminStatsRoutes)
  await fastify.register(adminStreamsRoutes)
  await fastify.register(adminUsersRoutes)

  // M20: tier gating
  await fastify.register(broadcastUsageRoutes)

  // M11: audit exports
  await fastify.register(adminAuditRoutes)
  await fastify.register(adminVenueRoutes)

  // M12: artist profile + releases + audio upload pipeline
  await fastify.register(meReleaseRoutes)
  await fastify.register(releaseTrackRoutes)
  await fastify.register(releaseTrackVersionRoutes)
  await fastify.register(releaseArtworkRoutes)
  await fastify.register(publicProfileRoutes)
  await fastify.register(publicMentionRoutes)
  await fastify.register(smartlinkRoutes)
  await fastify.register(smartlinkClickRoutes)
  await fastify.register(releaseAnalyticsRoutes)
  await fastify.register(sitemapRoutes)

  // M12 / M15: profile update (bio, social links) + mention detection
  await fastify.register(meProfileRoutes)

  // M14: embed widget + oEmbed
  await fastify.register(embedRoutes)

  // M7: Mixcloud upload for archive items
  await fastify.register(mixcloudRoutes)
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

  // M18: public release-track downloads with anti-fraud
  await fastify.register(releaseDownloadRoutes)

  // M22/M24/M25: archive item metadata edit + channel slideshow
  await fastify.register(meArchiveRoutes)
  await fastify.register(meProgrammeRoutes)
  await fastify.register(meChannelScheduleRoutes)
  await fastify.register(meArchiveVersionRoutes)
  await fastify.register(meDownloadGateStatsRoutes)
  await fastify.register(meChannelEgressRoutes)
  await fastify.register(meChannelLiveStatsRoutes)
  await fastify.register(meChannelFunnelStatsRoutes)
  await fastify.register(meUsersRoutes)

  // M23: collections + RSS feeds
  await fastify.register(collectionRoutes)

  return fastify
}
