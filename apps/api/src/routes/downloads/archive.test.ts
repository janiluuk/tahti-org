// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'

const TEST_EMAIL_PREFIX = 'download-test-'
const SLUG = 'download-test-channel'

describe('M18 — archive downloads + engagement units', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const user = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}artist@example.com`,
        passwordHash,
        username: 'download-test-artist',
        displayName: 'Download Artist',
        emailVerifiedAt: new Date(),
        isMember: true,
        channel: {
          create: {
            slug: SLUG,
            liveSourceMount: `/live/${SLUG}`,
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: `${SLUG}__x`,
            rtmpStreamKeyHash: 'x',
          },
        },
      },
      include: { channel: true },
    })
    channelId = user.channel!.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Downloadable mix',
        rawKey: 'raw/test.wav',
        mp3Key: 'mp3/test.mp3',
        fileSizeBytes: BigInt(6_000_000),
        status: 'READY',
      },
    })
    itemId = item.id
  })

  beforeEach(async () => {
    await prisma.download.deleteMany({ where: { channelId } })
  })

  afterAll(async () => {
    await prisma.download.deleteMany({ where: { channelId } })
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 404 for an unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/no-such-channel/archive/${itemId}/download?fp=abc`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('counts the first download (weight 1, counted)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-A`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().counted).toBe(true)
    expect(typeof res.json().url).toBe('string')

    const rows = await prisma.download.findMany({ where: { channelId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].countedAt).not.toBeNull()
    expect(rows[0].weight).toBe(1)
  })

  it('dedups a repeat download from the same fingerprint within 30 days', async () => {
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-B`,
    })
    expect(first.json().counted).toBe(true)

    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-B`,
    })
    // Download still succeeds for the listener…
    expect(second.statusCode).toBe(200)
    // …but does not count again.
    expect(second.json().counted).toBe(false)

    const counted = await prisma.download.count({
      where: { channelId, countedAt: { not: null } },
    })
    expect(counted).toBe(1)
  })

  it('rate-limits after 5 downloads in an hour (429)', async () => {
    // 5 distinct fingerprints from the same IP — dedup won't apply, but the
    // per-IP rate limit should trip on the 6th request.
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=rate-${i}`,
      })
      expect(res.statusCode).toBe(200)
    }
    const blocked = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=rate-final`,
    })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['retry-after']).toBeDefined()
  })
})
