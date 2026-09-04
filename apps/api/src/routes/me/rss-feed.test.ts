// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'rss-feed-'

describe('GET /api/me/rss-feed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'rss-feed-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/rss-feed?url=https://example.com/rss.xml',
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a missing url', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/rss-feed',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects loopback hosts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/rss-feed?url=${encodeURIComponent('http://127.0.0.1/rss.xml')}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
