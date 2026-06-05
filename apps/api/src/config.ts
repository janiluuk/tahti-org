// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readSecret } from './lib/read-secret.js'

const docsPass = readSecret('DOCS_PASS', 'DOCS_PASS_FILE', 'changeme')
if (process.env.NODE_ENV === 'production' && docsPass === 'changeme') {
  console.warn(
    '[config] DOCS_PASS is default "changeme" — set DOCS_PASS or DOCS_PASS_FILE in production',
  )
}

const smtpHost = process.env.SMTP_HOST ?? 'localhost'
if (process.env.NODE_ENV === 'production' && smtpHost === 'mailhog') {
  console.warn(
    '[config] SMTP_HOST is mailhog — outbound mail is captured locally only. For the vimage lab stack, relay via vimage6 (192.168.2.105); see infra/stack.env.vimage.example.',
  )
}

export const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://tahti:tahti_dev@localhost:5432/tahti',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-do-not-use-in-prod',
  sessionCookieName: 'tahti_session',
  sessionMaxAgeSec: 30 * 24 * 60 * 60, // 30 days
  email: {
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER ?? '',
    pass: readSecret('SMTP_PASS', 'SMTP_PASSWORD_FILE', ''),
    from: process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.live>',
    supportInbox: process.env.SUPPORT_INBOX?.trim() || 'support@tahti.live',
    /** M13: shared secret for Postmark/SES bounce webhooks (`X-Tahti-Webhook-Secret`). */
    bounceWebhookSecret: process.env.EMAIL_BOUNCE_WEBHOOK_SECRET?.trim() ?? '',
  },
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
  sourceRepoUrl: 'https://github.com/tahtiapp/tahti',
  isProd: process.env.NODE_ENV === 'production',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'tahti',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'tahti_dev_secret',
    bucket: process.env.MINIO_BUCKET ?? 'tahti',
    /** Bucket for Postgres dumps (`pg/*.sql.gz`). See `scripts/backup.sh`. */
    backupsBucket: process.env.MINIO_BACKUPS_BUCKET ?? 'backups',
    backupsPgPrefix: process.env.MINIO_BACKUPS_PG_PREFIX ?? 'pg/',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'http://localhost:9000',
  },
  internalSecret: process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod',
  centrifugo: {
    apiUrl: process.env.CENTRIFUGO_API_URL ?? 'http://localhost:8000/api',
    apiKey: process.env.CENTRIFUGO_API_KEY ?? 'dev',
    jwtSecret: process.env.CENTRIFUGO_JWT_SECRET ?? 'dev_secret_do_not_use_in_prod',
  },
  orchestratorUrl: process.env.ORCHESTRATOR_URL ?? 'http://localhost:3003',
  hlsBaseUrl: process.env.HLS_BASE_URL ?? 'http://localhost:9000/hls-live',
  rtmpIngestHost: process.env.RTMP_INGEST_HOST ?? 'localhost',
  /** STREAM-003: comma-separated RTMP ingest hostnames for health-ranked failover. */
  rtmpIngestHosts: process.env.RTMP_INGEST_HOSTS ?? '',
  rtmpIngestHealthPort: parseInt(process.env.RTMP_INGEST_HEALTH_PORT ?? '8080', 10),
  rtmpIngestHealthPath: process.env.RTMP_INGEST_HEALTH_PATH ?? '/health',
  rtmpIngestHealthScheme: process.env.RTMP_INGEST_HEALTH_SCHEME ?? 'http',
  /** STREAM-003 / STREAM-007: comma-separated Icecast ingest hostnames (public URLs). */
  icecastIngestHosts: process.env.ICECAST_INGEST_HOSTS ?? '',
  /** Icecast health probe path (status JSON). */
  icecastIngestHealthPath: process.env.ICECAST_INGEST_HEALTH_PATH ?? '/status-json.xsl',
  /** Internal hostname:port for Liquidsoap pull and ops (e.g. icecast:8000). */
  icecastHost: process.env.ICECAST_HOST ?? 'localhost:8100',
  /** Public ingest URL shown in dashboard (e.g. https://ingest-icecast.tahti.live or http://localhost:8100). */
  icecastPublicUrl:
    process.env.ICECAST_PUBLIC_URL ??
    (process.env.ICECAST_HOST?.startsWith('http')
      ? process.env.ICECAST_HOST
      : `http://${process.env.ICECAST_HOST ?? 'localhost:8100'}`),
  /** Base URL Liquidsoap uses to pull live Icecast mounts (no trailing slash). */
  icecastBaseUrl:
    process.env.ICECAST_BASE_URL ??
    (process.env.ICECAST_HOST?.startsWith('http')
      ? process.env.ICECAST_HOST
      : `http://${process.env.ICECAST_HOST ?? 'localhost:8100'}`),
  rtmpKeyEncKey:
    process.env.RTMP_KEY_ENC_KEY ??
    'dev0000000000000000000000000000000000000000000000000000000000000',
  hcaptchaSecret: process.env.HCAPTCHA_SECRET ?? 'dev',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    // When false (no key configured, e.g. dev/test), checkout flows activate
    // directly instead of redirecting to Stripe Checkout.
    enabled: !!process.env.STRIPE_SECRET_KEY,
  },
  membership: {
    priceCents: parseInt(process.env.MEMBERSHIP_PRICE_CENTS ?? '4000', 10),
  },
  distribution: {
    artistFeeCents: parseInt(process.env.DISTRIBUTION_FEE_CENTS ?? '800', 10),
    passThroughCents: parseInt(process.env.DISTRIBUTION_PASSTHROUGH_CENTS ?? '500', 10),
    studioIncludedPerYear: parseInt(process.env.STUDIO_INCLUDED_RELEASES_PER_YEAR ?? '12', 10),
  },
  download: {
    noCountCidrs: (process.env.DOWNLOAD_NO_COUNT_CIDRS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustOverrideIps: (process.env.DOWNLOAD_TRUST_OVERRIDE_IPS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ratePerHour: parseInt(process.env.DOWNLOAD_RATE_PER_HOUR ?? '5', 10),
    ratePerDay: parseInt(process.env.DOWNLOAD_RATE_PER_DAY ?? '20', 10),
  },
  rateLimit: {
    apiMaxPerMin: parseInt(process.env.RATE_LIMIT_API_MAX ?? '120', 10),
    authMaxPerMin: parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? '10', 10),
    /** When true (default), allow requests if Redis is unreachable. */
    redisFailOpen: process.env.RATE_LIMIT_REDIS_FAIL_OPEN !== 'false',
  },
  swagger: {
    docsUser: readSecret('DOCS_USER', 'DOCS_USER_FILE', 'tahti'),
    docsPass,
  },
  mixcloud: {
    clientId: process.env.MIXCLOUD_CLIENT_ID ?? '',
    clientSecret: readSecret('MIXCLOUD_CLIENT_SECRET', 'MIXCLOUD_CLIENT_SECRET_FILE', ''),
    redirectUri:
      process.env.MIXCLOUD_OAUTH_REDIRECT_URI ??
      `${process.env.API_URL ?? 'http://localhost:3001'}/api/me/mixcloud/oauth/callback`,
    oauthStateCookie: 'tahti_mixcloud_oauth',
  },
  /** STREAM-008: optional AcoustID key for live + archive tracklist title lookup. */
  acoustidApiKey: process.env.ACOUSTID_API_KEY?.trim() ?? '',
  acrcloud: {
    /** Post-production: set ACRCLOUD_ENABLED=true plus keys/secrets to enable identify at ingest. */
    enabled: process.env.ACRCLOUD_ENABLED === 'true',
    host: process.env.ACRCLOUD_HOST ?? 'identify-eu-west-1.acrcloud.com',
    accessKey: readSecret('ACRCLOUD_ACCESS_KEY', 'ACRCLOUD_ACCESS_KEY_FILE', ''),
    accessSecret: readSecret('ACRCLOUD_ACCESS_SECRET', 'ACRCLOUD_ACCESS_SECRET_FILE', ''),
  },
}
