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

const PREFIX = 'purchase-tier-test-'

describe('Purchase tiers (per-track paywall)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let artistUsername: string
  let artistCookie: string
  let subscriberId: string
  let subscriberCookie: string
  let buyerId: string
  let buyerCookie: string
  let strangerCookie: string

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
    artistUsername = artist.username
    artistCookie = await sessionCookieFor(prisma, artistId)

    const subscriber = await createTestArtist(prisma, {
      email: `${PREFIX}subscriber@example.com`,
      username: `${PREFIX}subscriber`,
    })
    subscriberId = subscriber.id
    subscriberCookie = await sessionCookieFor(prisma, subscriberId)
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: subscriberId,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `${PREFIX}sub`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const buyer = await createTestArtist(prisma, {
      email: `${PREFIX}buyer@example.com`,
      username: `${PREFIX}buyer`,
    })
    buyerId = buyer.id
    buyerCookie = await sessionCookieFor(prisma, buyerId)

    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
  })

  afterAll(async () => {
    await prisma.purchase.deleteMany({ where: { artistUserId: artistId } })
    await prisma.purchaseTier.deleteMany({ where: { artistUserId: artistId } })
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a one-time tier and lists it for its own artist', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/purchase-tiers',
      headers: { cookie: artistCookie },
      payload: { name: 'Demo pack', priceCents: 500 },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json()).toMatchObject({ name: 'Demo pack', priceCents: 500, active: true })

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/purchase-tiers',
      headers: { cookie: artistCookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toHaveLength(1)
  })

  it('gates a track behind SUBSCRIBERS_ONLY: subscriber gets in, stranger does not', async () => {
    const item = await prisma.archiveItem.create({
      data: {
        channel: { connect: { userId: artistId } },
        title: 'Subscriber-only track',
        status: 'READY',
        isPublic: true,
        accessMode: 'SUBSCRIBERS_ONLY',
        mp3Key: `${PREFIX}subs-track.mp3`,
      },
    })

    const asStranger = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artistUsername}/profile`,
      headers: { cookie: strangerCookie },
    })
    expect(asStranger.statusCode).toBe(200)
    const strangerTrack = asStranger.json().tracks.find((t: { id: string }) => t.id === item.id)
    expect(strangerTrack.playUrl).toBeNull()
    expect(strangerTrack.gate).toMatchObject({ reason: 'SUBSCRIBERS_ONLY' })

    const asSubscriber = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artistUsername}/profile`,
      headers: { cookie: subscriberCookie },
    })
    const subscriberTrack = asSubscriber.json().tracks.find((t: { id: string }) => t.id === item.id)
    expect(subscriberTrack.playUrl).not.toBeNull()

    await prisma.archiveItem.delete({ where: { id: item.id } })
  })

  it("gates a track behind a specific purchase tier: only that tier's buyer gets in", async () => {
    const tierA = await prisma.purchaseTier.create({
      data: { artistUserId: artistId, name: 'Tier A', priceCents: 0, priceOptional: true },
    })
    const tierB = await prisma.purchaseTier.create({
      data: { artistUserId: artistId, name: 'Tier B', priceCents: 300 },
    })

    const trackA = await prisma.archiveItem.create({
      data: {
        channel: { connect: { userId: artistId } },
        title: 'Tier A track',
        status: 'READY',
        isPublic: true,
        accessMode: 'PURCHASE',
        purchaseTier: { connect: { id: tierA.id } },
        mp3Key: `${PREFIX}tier-a.mp3`,
      },
    })
    const trackB = await prisma.archiveItem.create({
      data: {
        channel: { connect: { userId: artistId } },
        title: 'Tier B track',
        status: 'READY',
        isPublic: true,
        accessMode: 'PURCHASE',
        purchaseTier: { connect: { id: tierB.id } },
        mp3Key: `${PREFIX}tier-b.mp3`,
      },
    })

    // Buyer claims tier A for free (priceOptional, amountCents 0 — no Stripe involved).
    const checkout = await app.inject({
      method: 'POST',
      url: `/api/v1/u/${artistUsername}/purchase-tiers/${tierA.id}/checkout`,
      headers: { cookie: buyerCookie },
      payload: { amountCents: 0 },
    })
    expect(checkout.statusCode).toBe(201)
    expect(checkout.json()).toMatchObject({ activated: true })

    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artistUsername}/profile`,
      headers: { cookie: buyerCookie },
    })
    const tracks = profile.json().tracks as Array<{ id: string; playUrl: string | null }>
    const gotTrackA = tracks.find((t) => t.id === trackA.id)
    const gotTrackB = tracks.find((t) => t.id === trackB.id)
    expect(gotTrackA?.playUrl).not.toBeNull()
    // Buying tier A must not unlock tier B's track.
    expect(gotTrackB?.playUrl).toBeNull()

    // The artist's own orders list shows the sale.
    const orders = await app.inject({
      method: 'GET',
      url: '/api/me/purchase-tiers/orders',
      headers: { cookie: artistCookie },
    })
    expect(orders.statusCode).toBe(200)
    expect(orders.json()).toHaveLength(1)
    expect(orders.json()[0]).toMatchObject({ tier: { id: tierA.id } })

    await prisma.archiveItem.deleteMany({ where: { id: { in: [trackA.id, trackB.id] } } })
  })

  it('rejects assigning PURCHASE access to a track without a valid tier', async () => {
    const item = await prisma.archiveItem.create({
      data: {
        channel: { connect: { userId: artistId } },
        title: 'Untiered track',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}untiered.mp3`,
      },
    })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${item.id}/access`,
      headers: { cookie: artistCookie },
      payload: { accessMode: 'PURCHASE' },
    })
    expect(res.statusCode).toBe(400)
    await prisma.archiveItem.delete({ where: { id: item.id } })
  })

  it('Store section only appears in the public profile once storeEnabled is on', async () => {
    const tier = await prisma.purchaseTier.create({
      data: { artistUserId: artistId, name: 'Visible tier', priceCents: 200 },
    })

    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artistUsername}/profile`,
    })
    expect(before.json().purchaseTiers).toEqual([])

    await app.inject({
      method: 'PATCH',
      url: '/api/me/store-settings',
      headers: { cookie: artistCookie },
      payload: { storeEnabled: true },
    })

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artistUsername}/profile`,
    })
    const afterTiers = after.json().purchaseTiers as Array<{ id: string; name: string }>
    expect(afterTiers.length).toBeGreaterThan(0)
    expect(afterTiers).toContainEqual(
      expect.objectContaining({ id: tier.id, name: 'Visible tier' }),
    )
  })
})
