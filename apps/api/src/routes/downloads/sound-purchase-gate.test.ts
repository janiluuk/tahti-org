// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'dl-purchase-gate-'
const TEST_IP = '203.0.113.91'
const dlHeaders = { 'x-forwarded-for': TEST_IP }

describe('sound downloads — purchase/subscriber playback gate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let slug: string
  let artistCookie: string
  let buyerId: string
  let buyerCookie: string
  let subscriberCookie: string
  let strangerCookie: string
  let purchaseTierId: string
  let purchaseItemId: string
  let subscribersItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    artistId = artist.id
    slug = artist.channel!.slug
    artistCookie = await sessionCookieFor(prisma, artistId)

    const buyer = await createTestArtist(prisma, {
      email: `${PREFIX}buyer@example.com`,
      username: `${PREFIX}buyer`,
    })
    buyerId = buyer.id
    buyerCookie = await sessionCookieFor(prisma, buyer.id)

    const subscriber = await createTestArtist(prisma, {
      email: `${PREFIX}subscriber@example.com`,
      username: `${PREFIX}subscriber`,
    })
    subscriberCookie = await sessionCookieFor(prisma, subscriber.id)
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: subscriber.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `${PREFIX}sub`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)

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

    const purchaseItem = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Paywalled mix',
        rawKey: `${PREFIX}paid.wav`,
        mp3Key: `${PREFIX}paid.mp3`,
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
        accessMode: 'PURCHASE',
        purchaseTierId,
      },
    })
    purchaseItemId = purchaseItem.id

    const subscribersItem = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Subscribers-only mix',
        rawKey: `${PREFIX}subs.wav`,
        mp3Key: `${PREFIX}subs.mp3`,
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
        accessMode: 'SUBSCRIBERS_ONLY',
      },
    })
    subscribersItemId = subscribersItem.id

    await prisma.purchase.create({
      data: {
        artistUserId: artistId,
        buyerUserId: buyerId,
        tierId: purchaseTierId,
        amountCents: 500,
        state: 'PAID',
      },
    })
  })

  afterAll(async () => {
    await prisma.download.deleteMany({
      where: { soundId: { in: [purchaseItemId, subscribersItemId] } },
    })
    await prisma.purchase.deleteMany({ where: { artistUserId: artistId } })
    await prisma.purchaseTier.deleteMany({ where: { artistUserId: artistId } })
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('blocks anonymous download of a PURCHASE track, including the legacy archive path', async () => {
    const sounds = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${purchaseItemId}/download?format=source&fp=anon-paid`,
      headers: dlHeaders,
    })
    expect(sounds.statusCode).toBe(403)
    expect(sounds.json()).toMatchObject({
      error: 'Buy this track (or subscribe) to download',
      gate: 'PURCHASE',
      tierId: purchaseTierId,
    })
    expect(sounds.json().url).toBeUndefined()

    const archive = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/archive/${purchaseItemId}/download?format=source&fp=anon-paid-legacy`,
      headers: dlHeaders,
    })
    expect(archive.statusCode).toBe(403)
    expect(archive.json().gate).toBe('PURCHASE')
  })

  it('blocks anonymous and stranger download of a SUBSCRIBERS_ONLY track', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${subscribersItemId}/download?fp=anon-subs`,
      headers: dlHeaders,
    })
    expect(anon.statusCode).toBe(403)
    expect(anon.json()).toMatchObject({
      error: 'Subscribe to this artist to download',
      gate: 'SUBSCRIBERS_ONLY',
    })

    const stranger = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${subscribersItemId}/download?fp=stranger-subs`,
      headers: { ...dlHeaders, cookie: strangerCookie },
    })
    expect(stranger.statusCode).toBe(403)
    expect(stranger.json().gate).toBe('SUBSCRIBERS_ONLY')
  })

  it('lets the artist, a paid buyer, and an active fan-subscriber download', async () => {
    const asArtist = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${purchaseItemId}/download?fp=artist-paid`,
      headers: { ...dlHeaders, cookie: artistCookie },
    })
    expect(asArtist.statusCode).toBe(200)
    expect(asArtist.json().url).toBeTruthy()

    const asBuyer = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${purchaseItemId}/download?fp=buyer-paid`,
      headers: { ...dlHeaders, cookie: buyerCookie },
    })
    expect(asBuyer.statusCode).toBe(200)
    expect(asBuyer.json().url).toBeTruthy()

    const asSubscriber = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${slug}/sounds/${purchaseItemId}/download?fp=sub-paid`,
      headers: { ...dlHeaders, cookie: subscriberCookie },
    })
    expect(asSubscriber.statusCode).toBe(200)
    expect(asSubscriber.json().url).toBeTruthy()
  })
})
