// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

vi.mock('../../lib/minio.js', () => ({
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/presigned'),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
  s3: {},
}))

vi.mock('../../lib/queue.js', () => ({
  enqueueTranscode: vi.fn().mockResolvedValue(undefined),
  mediaQueue: {},
}))

const TEST_EMAIL_PREFIX = 'channel-items-test-'

describe('GET /api/channels/:slug/items', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const user = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: 'channel-items-testuser',
        displayName: 'Channel Items Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'channel-items-testuser',
            liveSourceMount: '/live/channel-items-testuser',
            liveSourcePass: 'dummypass',
            liveSourcePassHash: 'dummy',
            rtmpStreamKey: 'dummyslug__dummykey',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
      include: { channel: true },
    })

    channelId = user.channel!.id

    await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Ready Track',
        rawKey: 'raw/channel-items-testuser/abc.mp3',
        mp3Key: 'mp3/channel-items-testuser/item1.mp3',
        fileSizeBytes: 0,
        durationSec: 180,
        status: 'READY',
        isPublic: true,
        commentary: 'Thanks for listening — recorded live at Klubi.',
        peaks: [10, 50, 200, 80],
      },
    })

    await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Pending Track',
        rawKey: 'raw/channel-items-testuser/def.mp3',
        fileSizeBytes: 0,
        status: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns empty array for channel with no ready items (unknown slug)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/does-not-exist-xyz/items',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns only READY items with audioUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/channel-items-testuser/items',
    })
    expect(res.statusCode).toBe(200)
    const items = res.json()
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Ready Track')
    expect(items[0].audioUrl).toBe('https://minio.test/get')
    expect(items[0].commentary).toBe('Thanks for listening — recorded live at Klubi.')
    expect(items[0].peaks).toEqual([10, 50, 200, 80])
  })

  it('serves flac when item has no mp3', async () => {
    await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Lossless Track',
        rawKey: 'raw/channel-items-testuser/lossless.flac',
        flacKey: 'flac/channel-items-testuser/lossless.flac',
        fileSizeBytes: 0,
        durationSec: 240,
        status: 'READY',
        isPublic: true,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/channel-items-testuser/items',
    })
    expect(res.statusCode).toBe(200)
    const items = res.json()
    expect(items).toHaveLength(2)
    const lossless = items.find((i: { title: string }) => i.title === 'Lossless Track')
    expect(lossless.audioUrl).toBe('https://minio.test/get')
  })
})
