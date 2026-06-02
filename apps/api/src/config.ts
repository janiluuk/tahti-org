// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

export const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://tahti:tahti_dev@localhost:5432/tahti',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-session-secret-do-not-use-in-prod',
  sessionCookieName: 'tahti_session',
  sessionMaxAgeSec: 30 * 24 * 60 * 60, // 30 days
  email: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Tahti <noreply@tahti.fi>',
  },
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.API_URL ?? 'http://localhost:3001',
  sourceRepoUrl: 'https://github.com/tahtiapp/tahti',
  isProd: process.env.NODE_ENV === 'production',
}
