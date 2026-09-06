// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../test/helpers.js'

vi.mock('../lib/minio.js', () => ({
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/presigned'),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
  s3: {},
}))

const PREFIX = 'playback-list-gate-'
const GENRE = 'PlaybackListGateTechno'

describe('public list/play purchase gate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let slug: string
  let artistCookie: string
  let purchaseTierId: string
  let purchaseItemId: string
  let collectionSlug: string
  let smartLinkSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Playback Gate Artist',
      tier: 'ARTIST',
    })
    artistId = artist.id
    slug = artist.channel!.slug
    artistCookie = await sessionCookieFor(prisma, artistId)

    const tier = await prisma.purchaseTier.create({
      data: {
        artistUserId: artistId,
        name: 'Digital download',
        priceCents: 500,
        active: true,
        position: 0,
      },
    })
    purchaseTierId = tier.id

    const item = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Paywalled list track',
        rawKey: `${PREFIX}paid.wav`,
        mp3Key: `${PREFIX}paid.mp3`,
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
        genre: GENRE,
        accessMode: 'PURCHASE',
        purchaseTierId,
        releasedAt: new Date('2030-01-01'),
      },
    })
    purchaseItemId = item.id

    collectionSlug = `${PREFIX}col`
    const collection = await prisma.collection.create({
      data: {
        userId: artistId,
        slug: collectionSlug,
        name: 'Gated playlist',
        isPublic: true,
      },
    })
    await prisma.collectionItem.create({
      data: { collectionId: collection.id, soundId: item.id, position: 0 },
    })

    smartLinkSlug = `${PREFIX}rel`
    await prisma.release.create({
      data: {
        userId: artistId,
        title: 'Gated EP',
        type: 'SINGLE',
        releaseDate: new Date('2030-01-01'),
        smartLinkSlug,
        state: 'PUBLISHED',
        publishedAt: new Date(),
        tracks: {
          create: {
            position: 1,
            title: 'Paywalled list track',
            status: 'READY',
            soundId: item.id,
            streamKey: `${PREFIX}stream.opus`,
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.collectionItem.deleteMany({ where: { soundId: purchaseItemId } })
    await prisma.collection.deleteMany({ where: { slug: collectionSlug } })
    await prisma.sound.deleteMany({ where: { id: purchaseItemId } })
    await prisma.purchaseTier.deleteMany({ where: { artistUserId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/channels/:slug/items nulls audioUrl for anonymous viewers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${slug}/items`,
    })
    expect(res.statusCode).toBe(200)
    const items = res.json() as Array<{
      id: string
      audioUrl: string | null
      gate: { reason: string; tierId?: string } | null
    }>
    const gated = items.find((i) => i.id === purchaseItemId)
    expect(gated).toBeTruthy()
    expect(gated!.audioUrl).toBeNull()
    expect(gated!.gate).toEqual({ reason: 'PURCHASE', tierId: purchaseTierId })
  })

  it('GET /api/channels/:slug/items still presigns for the artist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${slug}/items`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json() as Array<{
      id: string
      audioUrl: string | null
      gate: unknown
    }>
    const gated = items.find((i) => i.id === purchaseItemId)
    expect(gated!.audioUrl).toBe('https://minio.test/get')
    expect(gated!.gate).toBeNull()
  })

  it('GET /api/discover/latest-tracks nulls audioUrl for anonymous viewers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/discover/latest-tracks?genre=${GENRE}`,
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{
      soundId: string
      audioUrl: string | null
      gate: { reason: string; tierId?: string } | null
    }>
    const gated = items.find((i) => i.soundId === purchaseItemId)
    expect(gated).toBeTruthy()
    expect(gated!.audioUrl).toBeNull()
    expect(gated!.gate).toEqual({ reason: 'PURCHASE', tierId: purchaseTierId })
  })

  it('GET /api/v1/collections/:slug nulls sound.audioUrl for anonymous viewers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}`,
    })
    expect(res.statusCode).toBe(200)
    const sound = res.json().items[0].sound as {
      id: string
      audioUrl: string | null
      gate: { reason: string; tierId?: string } | null
      channel: { slug: string }
    }
    expect(sound.id).toBe(purchaseItemId)
    expect(sound.audioUrl).toBeNull()
    expect(sound.gate).toEqual({ reason: 'PURCHASE', tierId: purchaseTierId })
    expect(sound.channel).toEqual({ slug })
  })

  it('GET embed collection play returns 403 for anonymous viewers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/col/${collectionSlug}/tracks/${purchaseItemId}/play`,
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({
      error: 'Buy this track (or subscribe) to play',
      gate: 'PURCHASE',
      tierId: purchaseTierId,
    })
  })

  it('GET embed collection play returns a signed URL for the artist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/col/${collectionSlug}/tracks/${purchaseItemId}/play`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toBe('https://minio.test/get')
  })

  it('omits RSS enclosures for gated channel and collection sounds', async () => {
    const channelRss = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/rss.xml`,
    })
    expect(channelRss.statusCode).toBe(200)
    expect(channelRss.body).toContain('Paywalled list track')
    expect(channelRss.body).not.toContain(`${PREFIX}paid.mp3`)
    expect(channelRss.body).not.toContain('<enclosure')

    const colRss = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}/rss.xml`,
    })
    expect(colRss.statusCode).toBe(200)
    expect(colRss.body).toContain('Paywalled list track')
    expect(colRss.body).not.toContain(`${PREFIX}paid.mp3`)
    expect(colRss.body).not.toContain('<enclosure')
  })

  it('GET /api/v1/r/:slug nulls audioUrl for a linked gated Sound', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${smartLinkSlug}`,
    })
    expect(res.statusCode).toBe(200)
    const track = res.json().release.tracks[0] as {
      audioUrl: string | null
      gate: { reason: string; tierId?: string } | null
    }
    expect(track.audioUrl).toBeNull()
    expect(track.gate).toEqual({ reason: 'PURCHASE', tierId: purchaseTierId })
  })

  it('GET /api/v1/r/:slug still presigns for the artist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${smartLinkSlug}`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().release.tracks[0].audioUrl).toBe('https://minio.test/get')
    expect(res.json().release.tracks[0].gate).toBeNull()
  })
})
