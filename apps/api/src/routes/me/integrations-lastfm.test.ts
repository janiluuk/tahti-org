// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'lastfm-prepare-test-'

describe('/api/me/integrations/lastfm/prepare', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
      displayName: 'Last.fm Prepare',
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/lastfm/prepare',
      headers: { cookie },
      payload: { apiKey: 'only-key' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns Last.fm authUrl and sets pending cookies', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ token: 'tmp-tok' }), { status: 200 })),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/lastfm/prepare',
      headers: { cookie },
      payload: { apiKey: 'user-key', apiSecret: 'user-secret' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { authUrl: string }
    expect(body.authUrl).toContain('https://www.last.fm/api/auth')
    expect(body.authUrl).toContain('api_key=user-key')
    expect(body.authUrl).toContain('token=tmp-tok')
    const setCookie = res.headers['set-cookie']
    const cookies = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie ?? '')
    expect(cookies).toContain('tahti_lastfm_pending_api_key=')
    expect(cookies).toContain('tahti_lastfm_pending_api_secret=')
    expect(cookies).toContain('tahti_lastfm_oauth_token=')
  })
})
