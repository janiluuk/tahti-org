// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/stream-key-enc.js', () => ({
  encryptStreamKey: (plain: string) => `enc:${plain}`,
  decryptStreamKey: (enc: string) => enc.replace(/^enc:/, ''),
}))

vi.mock('../../lib/queue.js', () => ({
  mediaQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'social-test-'

function mockSocialFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url)
      if (u.includes('/api/v1/statuses')) {
        return {
          ok: true,
          json: async () => ({ id: 'mastodon-status-1' }),
        }
      }
      if (u.includes('com.atproto.server.createSession')) {
        return {
          ok: true,
          json: async () => ({
            accessJwt: 'bsky-jwt',
            did: 'did:plc:test',
          }),
        }
      }
      if (u.includes('com.atproto.repo.createRecord')) {
        return {
          ok: true,
          json: async () => ({ uri: 'at://did:plc:test/app.bsky.feed.post/abc' }),
        }
      }
      throw new Error(`Unexpected fetch: ${u} ${init?.method ?? 'GET'}`)
    }) as unknown as typeof fetch,
  )
}

describe('M14 — social auto-post', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    mockSocialFetch()

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
    expect(res.json().mastodon.connected).toBe(true)
    expect(res.json().mastodon.onReleasePublished).toBe(true)
    expect(res.json().bluesky.connected).toBe(false)
  })

  it('GET /api/me/social returns all platforms', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/social',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().mastodon.accountLabel).toBe('https://mastodon.example')
    expect(res.json().bluesky.connected).toBe(false)
    expect(res.json().twitter.connected).toBe(false)
    expect(res.json().twitter.configured).toBe(false)
  })

  it('PUT bluesky connect stores connection', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/me/social/bluesky',
      headers: { cookie },
      payload: {
        handle: 'artist.bsky.social',
        appPassword: 'test-app-password',
        onChannelLive: true,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().bluesky.connected).toBe(true)
    expect(res.json().bluesky.onChannelLive).toBe(true)
    expect(res.json().mastodon.connected).toBe(true)
  })

  it('POST /api/me/social/post queues manual Mastodon post', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/social/post',
      headers: { cookie },
      payload: { platform: 'MASTODON', message: 'Hello from Tahti test' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().platform).toBe('MASTODON')
    expect(res.json().state).toBe('PENDING')

    const post = await prisma.socialPost.findFirst({
      where: { userId, trigger: 'manual' },
      orderBy: { createdAt: 'desc' },
    })
    expect(post?.message).toBe('Hello from Tahti test')
  })

  it('DELETE /api/me/social/mastodon removes connection', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/me/social/mastodon',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const conn = await prisma.socialConnection.findUnique({
      where: { userId_platform: { userId, platform: 'MASTODON' } },
    })
    expect(conn).toBeNull()
  })
})
