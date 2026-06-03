// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'channel-get-test-'

describe('GET /api/channels/:slug', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: 'channel-get-testuser',
        displayName: 'Channel Get Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'channel-get-testuser',
            liveSourceMount: '/live/channel-get-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'dummyslug__dummykey',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 404 for unknown slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/does-not-exist-xyz',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 with channel data for known slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/channel-get-testuser',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.slug).toBe('channel-get-testuser')
    expect(body.user.displayName).toBe('Channel Get Test')
    expect(body.user.username).toBe('channel-get-testuser')
    expect(body.hlsUrl).toBeNull()
  })

  it('includes tier-based HLS URL when LIVE', async () => {
    await prisma.user.update({
      where: { username: 'channel-get-testuser' },
      data: { tier: 'ARTIST' },
    })
    await prisma.channel.update({
      where: { slug: 'channel-get-testuser' },
      data: { state: 'LIVE' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/channel-get-testuser',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().hlsUrl).toContain('stream-flac')

    await prisma.channel.update({
      where: { slug: 'channel-get-testuser' },
      data: { state: 'OFFLINE' },
    })
    await prisma.user.update({
      where: { username: 'channel-get-testuser' },
      data: { tier: 'FREE' },
    })
  })
})
