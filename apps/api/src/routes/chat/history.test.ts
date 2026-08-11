// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'chat-history-test-'

describe('GET /api/chat/:slug/history', () => {
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
        username: 'chat-history-testuser',
        displayName: 'History Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'chat-history-testuser',
            liveSourceMount: '/live/chat-history-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'chat-history-testuser__dummykey',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })
    // Separate channel from the "empty" test above — /api/chat/:slug/history
    // caches its result per slug for 5s (getCachedJson), so reusing the same
    // slug for both an empty check and a populated check risks the second
    // one reading the first's cached empty response.
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}populated@example.com`,
        passwordHash,
        username: 'chat-history-populated',
        displayName: 'History Populated Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'chat-history-populated',
            liveSourceMount: '/live/chat-history-populated',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'chat-history-populated__dummykey',
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
    const res = await app.inject({ method: 'GET', url: '/api/chat/no-such-xyz/history' })
    expect(res.statusCode).toBe(404)
  })

  it('returns an empty message list when nothing has been posted', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/chat-history-testuser/history',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().messages).toEqual([])
  })

  it('returns persisted messages in chronological order, excluding fan-only ones', async () => {
    const channel = await prisma.channel.findFirstOrThrow({
      where: { slug: 'chat-history-populated' },
    })
    await prisma.chatMessage.createMany({
      data: [
        { channelId: channel.id, handle: 'alice', text: 'first', fanOnly: false },
        { channelId: channel.id, handle: 'bob', text: 'fans only', fanOnly: true },
        { channelId: channel.id, handle: 'carol', text: 'second', fanOnly: false },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/chat-history-populated/history',
    })
    expect(res.statusCode).toBe(200)
    const messages = res.json().messages as { handle: string; text: string }[]
    expect(messages.map((m) => m.text)).toEqual(['first', 'second'])
  })
})
