// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { config } from '../../config.js'

const HOUR_MS = 60 * 60 * 1000

function ipHashForTest(ip: string): string {
  const day = new Date().toISOString().slice(0, 10)
  const salt = createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex')
}

const TEST_EMAIL_PREFIX = 'download-test-'
const SLUG = 'download-test-channel'
// Isolated IP so rate-limit tests are not affected by other suites on 127.0.0.1.
const TEST_IP = '203.0.113.55'
const dlHeaders = { 'x-forwarded-for': TEST_IP }

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

  it('does not count the first download from a brand-new IP (24h threshold)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-new-ip`,
      headers: dlHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().counted).toBe(false)

    const row = await prisma.download.findFirst({ where: { channelId } })
    expect(row?.reason).toBe('new_ip')
  })

  it('counts download when IP was first seen 24h+ ago', async () => {
    const byIpHash = ipHashForTest(TEST_IP)
    const seenAt = new Date(Date.now() - 25 * HOUR_MS)
    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: itemId,
        format: 'mp3_320',
        byFingerprint: 'ip-seed-fp',
        byIpHash,
        countedAt: seenAt,
        weight: 1,
        bytes: 0,
        createdAt: seenAt,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-A`,
      headers: dlHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().counted).toBe(true)

    const counted = await prisma.download.count({
      where: { channelId, countedAt: { not: null } },
    })
    expect(counted).toBe(2)
  })

  it('does not count downloads with bot user agents', async () => {
    const botIp = '203.0.113.88'
    const byIpHash = ipHashForTest(botIp)
    const day = new Date().toISOString().slice(0, 10)
    const salt = createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
    const byFingerprint = createHash('sha256').update(`bot-fp:${salt}`).digest('hex')
    const seenAt = new Date(Date.now() - 25 * HOUR_MS)
    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: itemId,
        format: 'mp3_320',
        byFingerprint: 'bot-ip-seed',
        byIpHash,
        countedAt: seenAt,
        weight: 1,
        bytes: 0,
        createdAt: seenAt,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=bot-fp`,
      headers: { 'x-forwarded-for': botIp, 'user-agent': 'python-requests/2.31' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().counted).toBe(false)

    const row = await prisma.download.findFirst({
      where: { channelId, byFingerprint },
    })
    expect(row?.reason).toBe('bot_ua')
  })

  it('dedups a repeat download from the same fingerprint within 30 days', async () => {
    const byIpHash = ipHashForTest(TEST_IP)
    const seenAt = new Date(Date.now() - 25 * HOUR_MS)
    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: itemId,
        format: 'mp3_320',
        byFingerprint: 'dedup-ip-seed',
        byIpHash,
        countedAt: null,
        reason: 'new_ip',
        weight: 1,
        bytes: 0,
        createdAt: seenAt,
      },
    })

    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-B`,
      headers: dlHeaders,
    })
    expect(first.json().counted).toBe(true)

    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=fingerprint-B`,
      headers: dlHeaders,
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
    await prisma.download.deleteMany({ where: { channelId } })
    // 5 distinct fingerprints from the same IP — dedup won't apply, but the
    // per-IP rate limit should trip on the 6th request.
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=rate-${i}`,
        headers: dlHeaders,
      })
      expect(res.statusCode).toBe(200)
    }
    const blocked = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${itemId}/download?fp=rate-final`,
      headers: dlHeaders,
    })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.headers['retry-after']).toBeDefined()
  })
})
