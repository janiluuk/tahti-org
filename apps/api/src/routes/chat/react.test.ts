// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'chat-react-test-'

describe('POST /api/chat/:slug/react', () => {
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
        username: 'chat-react-testuser',
        displayName: 'React Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'chat-react-testuser',
            liveSourceMount: '/live/chat-react-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'chat-react-testuser__dummykey',
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

  it('returns 400 for invalid emoji', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/chat-react-testuser/react',
      payload: { emoji: '🍕' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when emoji is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/chat-react-testuser/react',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/no-such-channel-xyz/react',
      payload: { emoji: '💜' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 for valid emoji (Centrifugo offline is tolerated)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/chat-react-testuser/react',
      payload: { emoji: '💜' },
    })
    // 200 even if Centrifugo is not running — publish failure is fire-and-forget
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

describe('GET /api/chat/:slug/reactions-token', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const TOKEN_TEST_EMAIL = `${TEST_EMAIL_PREFIX}token@example.com`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: TOKEN_TEST_EMAIL } })
    const passwordHash = await hashPassword('testpassword')
    await prisma.user.create({
      data: {
        email: TOKEN_TEST_EMAIL,
        passwordHash,
        username: 'chat-token-testuser',
        displayName: 'Token Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'chat-token-testuser',
            liveSourceMount: '/live/chat-token-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'chat-token-testuser__dummykey',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TOKEN_TEST_EMAIL } })
    await app.close()
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/no-such-channel-xyz/reactions-token',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns a JWT token for known channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/chat-token-testuser/reactions-token',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.token).toBe('string')
    // JWT: three base64url segments
    expect(body.token.split('.').length).toBe(3)
  })
})
