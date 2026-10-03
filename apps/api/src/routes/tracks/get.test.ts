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

const TEST_EMAIL_PREFIX = 'track-get-test-'

describe('GET /api/tracks/:id', () => {
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
        username: 'track-get-testuser',
        displayName: 'Track Get Test',
        avatarUrl: 'https://cdn.test/avatar.png',
        bio: 'Bedroom producer making slow ambient sets.',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'track-get-testuser',
            liveSourceMount: '/live/track-get-testuser',
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
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('returns 404 for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tracks/does-not-exist-xyz' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/tracks/${'x'.repeat(65)}` })
    expect(res.statusCode).toBe(400)
  })

  it('returns full detail with real peaks and channel info for a ready public track', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Full Detail Track',
        rawKey: 'raw/track-get-testuser/abc.mp3',
        mp3Key: 'mp3/track-get-testuser/item1.mp3',
        fileSizeBytes: 0,
        durationSec: 180,
        genre: 'Ambient',
        status: 'READY',
        isPublic: true,
        commentary: 'Recorded live at Klubi.',
        peaks: [10, 50, 200, 80],
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(item.id)
    expect(body.title).toBe('Full Detail Track')
    expect(body.artistName).toBe('Track Get Test')
    expect(body.channelSlug).toBe('track-get-testuser')
    expect(body.channel).toEqual({
      username: 'track-get-testuser',
      displayName: 'Track Get Test',
      avatarUrl: 'https://cdn.test/avatar.png',
      bio: 'Bedroom producer making slow ambient sets.',
    })
    expect(body.audioUrl).toBe('https://minio.test/get')
    expect(body.peaks).toEqual([10, 50, 200, 80])
    expect(body.commentary).toBe('Recorded live at Klubi.')
    expect(body.commentCount).toBe(0)
    expect(body.downloadCount).toBe(0)
    expect(body.accessMode).toBe('FREE')
    expect(body.isAiGenerated).toBe(false)
    expect(body.downloadsEnabled).toBe(true)
    expect(body.gate).toBeNull()
  })

  it('names the verified venue a track was recorded at, and hides an unverified one', async () => {
    const [verified, unverified] = await Promise.all([
      prisma.venue.create({
        data: {
          slug: 'track-get-test-venue-verified',
          name: 'Kaiku',
          address: '1 Test St',
          city: 'Helsinki',
          verifiedAt: new Date(),
          createdBy: 'track-get-test',
        },
      }),
      prisma.venue.create({
        data: {
          slug: 'track-get-test-venue-unverified',
          name: 'Pending Club',
          address: '2 Test St',
          city: 'Helsinki',
          createdBy: 'track-get-test',
        },
      }),
    ])
    const base = {
      channelId,
      rawKey: 'raw/track-get-testuser/venue.mp3',
      fileSizeBytes: 0,
      status: 'READY' as const,
      isPublic: true,
    }
    const atVerified = await prisma.sound.create({
      data: { ...base, title: 'Live at Kaiku', venueId: verified.id },
    })
    const atUnverified = await prisma.sound.create({
      data: { ...base, title: 'Live at Pending', venueId: unverified.id },
    })

    try {
      const res = await app.inject({ method: 'GET', url: `/api/tracks/${atVerified.id}` })
      expect(res.json().venue).toEqual({ name: 'Kaiku', slug: 'track-get-test-venue-verified' })
      const hidden = await app.inject({ method: 'GET', url: `/api/tracks/${atUnverified.id}` })
      expect(hidden.json().venue).toBeNull()
    } finally {
      await prisma.sound.deleteMany({ where: { id: { in: [atVerified.id, atUnverified.id] } } })
      await prisma.venue.deleteMany({ where: { slug: { startsWith: 'track-get-test-venue-' } } })
    }
  })

  it('returns the artist-defined tags', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Tagged Track',
        rawKey: 'raw/track-get-testuser/tagged.mp3',
        mp3Key: 'mp3/track-get-testuser/tagged.mp3',
        fileSizeBytes: 0,
        status: 'READY',
        isPublic: true,
        tags: ['Late Night', 'field recording'],
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().tags).toEqual(['Late Night', 'field recording'])
  })

  it('exposes the artist-declared AI-generated flag', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'AI Track',
        rawKey: 'raw/track-get-testuser/ai.mp3',
        mp3Key: 'mp3/track-get-testuser/ai.mp3',
        fileSizeBytes: 0,
        status: 'READY',
        isPublic: true,
        isAiGenerated: true,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().isAiGenerated).toBe(true)
  })

  it('tells the track page when the artist switched downloads off', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Stream only',
        rawKey: 'raw/track-get-testuser/stream-only.mp3',
        mp3Key: 'mp3/track-get-testuser/stream-only.mp3',
        fileSizeBytes: 0,
        status: 'READY',
        isPublic: true,
        downloadsEnabled: false,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().downloadsEnabled).toBe(false)
  })

  it('nulls audioUrl and exposes purchase gate for anonymous viewers', async () => {
    const artist = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { userId: true },
    })
    const tier = await prisma.purchaseTier.create({
      data: {
        artistUserId: artist.userId,
        name: 'Digital download',
        priceCents: 500,
        priceOptional: true,
        active: true,
        position: 0,
      },
    })
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Paywalled Track',
        rawKey: 'raw/track-get-testuser/paid.mp3',
        mp3Key: 'mp3/track-get-testuser/paid.mp3',
        fileSizeBytes: 0,
        durationSec: 200,
        status: 'READY',
        isPublic: true,
        accessMode: 'PURCHASE',
        purchaseTierId: tier.id,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.audioUrl).toBeNull()
    expect(body.accessMode).toBe('PURCHASE')
    expect(body.purchaseTierId).toBe(tier.id)
    expect(body.purchaseTierName).toBe('Digital download')
    expect(body.purchaseTierPriceCents).toBe(500)
    expect(body.purchaseTierPriceOptional).toBe(true)
    expect(body.gate).toEqual({ reason: 'PURCHASE', tierId: tier.id })
  })

  it('does not serve a private track', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Private Track',
        rawKey: 'raw/track-get-testuser/private.mp3',
        mp3Key: 'mp3/track-get-testuser/private.mp3',
        fileSizeBytes: 0,
        status: 'READY',
        isPublic: false,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(404)
  })

  it('does not serve a track that is not yet READY', async () => {
    const item = await prisma.sound.create({
      data: {
        channelId,
        title: 'Pending Track',
        rawKey: 'raw/track-get-testuser/pending.mp3',
        fileSizeBytes: 0,
        status: 'PENDING',
        isPublic: true,
      },
    })

    const res = await app.inject({ method: 'GET', url: `/api/tracks/${item.id}` })
    expect(res.statusCode).toBe(404)
  })
})
