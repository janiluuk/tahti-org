// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'chat-presence-test-'

describe('GET /api/channels/:slug/presence', () => {
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
        username: 'chat-presence-testuser',
        displayName: 'Presence Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'chat-presence-testuser',
            liveSourceMount: '/live/chat-presence-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'chat-presence-testuser__dummykey',
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

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/channels/no-such-xyz/presence' })
    expect(res.statusCode).toBe(404)
  })

  it('returns numClients=0 when Centrifugo is unavailable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/chat-presence-testuser/presence',
    })
    expect(res.statusCode).toBe(200)
    // Centrifugo not running in test — falls back to 0
    expect(res.json().numClients).toBe(0)
  })
})
