// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { cleanupUsersByEmailPrefix, createPublishedReleaseWithTrack } from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/download'),
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/put'),
  s3: {},
}))

const PREFIX = 'rel-dl-'
const TEST_IP = '203.0.113.88'
const dlHeaders = { 'x-forwarded-for': TEST_IP }

function seedIpHistory(channelId: string) {
  const day = new Date().toISOString().slice(0, 10)
  const salt = createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
  const byIpHash = createHash('sha256').update(`${TEST_IP}:${salt}`).digest('hex')
  const seenAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
  return prisma.download.create({
    data: {
      channelId,
      format: 'opus256',
      byFingerprint: 'rel-dl-ip-seed',
      byIpHash,
      countedAt: null,
      reason: 'new_ip',
      weight: 1,
      bytes: 0,
      createdAt: seenAt,
    },
  })
}

describe('M18 — release track downloads', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let smartLinkSlug: string
  let trackId: string
  let artistId: string
  let channelId: string
  let fanCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'rel-dl-artist',
        displayName: 'Rel DL Artist',
        emailVerifiedAt: new Date(),
        channel: {
          create: {
            slug: 'rel-dl-artist',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
      include: { channel: true },
    })
    artistId = artist.id
    channelId = artist.channel!.id

    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'rel-dl-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })
    fanCookie = `tahti_session=${(await createSession(prisma, fan.id)).id}`

    smartLinkSlug = 'rel-dl-release'
    const release = await createPublishedReleaseWithTrack(prisma, artistId, {
      smartLinkSlug,
      streamKey: 'streams/rel.opus',
      flacKey: 'streams/rel.flac',
    })
    trackId = release.tracks[0].id

    await prisma.fanTier.create({
      data: {
        artistUserId: artistId,
        name: 'Backer',
        amountCents: 500,
        position: 0,
        active: true,
      },
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: `dev_${artistId}_${fan.id}`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
  })

  beforeEach(async () => {
    await prisma.download.deleteMany({
      where: { OR: [{ channelId }, { releaseTrackId: trackId }] },
    })
    await seedIpHistory(channelId)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns a download URL and counts engagement for anonymous listeners', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?fp=rel-anon`,
      headers: dlHeaders,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toBeTruthy()
    expect(res.json().counted).toBe(true)

    const dl = await prisma.download.findFirst({ where: { releaseTrackId: trackId } })
    expect(dl?.weight).toBe(1)
  })

  it('weights fan-subscriber downloads 5×', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?fp=rel-fan`,
      headers: { ...dlHeaders, cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    const dl = await prisma.download.findFirst({
      where: { releaseTrackId: trackId, byUserId: { not: null } },
    })
    expect(dl?.weight).toBe(5)
  })

  it('requires fan subscription for FLAC format', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?format=flac&fp=x`,
      headers: dlHeaders,
    })
    expect(anon.statusCode).toBe(403)

    const fan = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?format=flac&fp=y`,
      headers: { ...dlHeaders, cookie: fanCookie },
    })
    expect(fan.statusCode).toBe(200)
    expect(fan.json().format).toBe('flac')
  })

  it('deduplicates repeat downloads within 30 days', async () => {
    const fp = 'rel-dedup-fp'
    const first = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?fp=${fp}`,
      headers: dlHeaders,
    })
    expect(first.json().counted).toBe(true)

    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/${trackId}/download?fp=${fp}`,
      headers: dlHeaders,
    })
    expect(second.json().counted).toBe(false)

    const counted = await prisma.download.count({
      where: { releaseTrackId: trackId, countedAt: { not: null } },
    })
    expect(counted).toBe(1)
  })

  it('returns 404 for unknown slug or track', async () => {
    const badSlug = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/no-such-slug/tracks/${trackId}/download`,
      headers: dlHeaders,
    })
    expect(badSlug.statusCode).toBe(404)

    const badTrack = await app.inject({
      method: 'GET',
      url: `/api/v1/releases/${smartLinkSlug}/tracks/nonexistent/download`,
      headers: dlHeaders,
    })
    expect(badTrack.statusCode).toBe(404)
  })
})
