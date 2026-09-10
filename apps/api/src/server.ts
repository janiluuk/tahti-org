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
import { registerAllRoutes } from './register-routes/index.js'
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
    // SEC-014: exactly one reverse proxy fronts the API in every real
    // deployment (NPM for api.tahti.live in prod; nothing in dev/test, where
    // there's no X-Forwarded-For to begin with). `true` trusted the entire
    // X-Forwarded-For chain and took its left-most (client-supplied, hence
    // spoofable) entry — a caller could prepend any address, e.g. a private
    // one, and have it believed. `1` trusts exactly the nearest hop and
    // returns the address *that hop* observed, which a client can't override.
    trustProxy: 1,
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

  await registerAllRoutes(fastify)

  return fastify
}
