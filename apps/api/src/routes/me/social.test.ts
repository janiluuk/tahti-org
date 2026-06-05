// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/stream-key-enc.js', () => ({
  encryptStreamKey: (plain: string) => `enc:${plain}`,
  decryptStreamKey: (enc: string) => enc.replace(/^enc:/, ''),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'social-test-'

describe('M14 — Mastodon social auto-post', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: 'mastodon-status-1' }),
      })) as unknown as typeof fetch,
    )

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'social-test-artist',
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await prisma.socialPost.deleteMany({ where: { userId } })
    await prisma.socialConnection.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('PUT mastodon connect stores connection', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/me/social/mastodon',
      headers: { cookie },
      payload: {
        instanceUrl: 'https://mastodon.example',
        accessToken: 'test-token',
        onReleasePublished: true,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().connected).toBe(true)
    expect(res.json().onReleasePublished).toBe(true)
  })

  it('GET /api/me/social returns connection', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/social',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().instanceUrl).toBe('https://mastodon.example')
  })
})
