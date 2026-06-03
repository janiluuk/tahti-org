// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { hashPassword } from './password.js'
import {
  artistOffersFanChat,
  subscriberHasFanChat,
  FAN_PERK_FAN_CHAT,
  FAN_PERK_FAN_NEWSLETTER,
  fanOnlyNewsletterSubscriberIds,
} from './fan-perks.js'

const PREFIX = 'fan-perks-'

describe('fan perk helpers', () => {
  let artistId: string
  let fanId: string

  beforeAll(async () => {
    await prisma.newsletterSubscriber.deleteMany({
      where: { artist: { email: { startsWith: PREFIX } } },
    })
    await prisma.fanSubscription.deleteMany({
      where: { artist: { email: { startsWith: PREFIX } } },
    })
    await prisma.fanTier.deleteMany({ where: { artist: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'fan-perks-artist',
        displayName: 'Artist',
        emailVerifiedAt: new Date(),
      },
    })
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'fan-perks-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })
    artistId = artist.id
    fanId = fan.id

    await prisma.fanTier.create({
      data: {
        artistUserId: artistId,
        name: 'Insider',
        amountCents: 500,
        perks: [FAN_PERK_FAN_CHAT, FAN_PERK_FAN_NEWSLETTER],
        active: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.newsletterSubscriber.deleteMany({ where: { artistUserId: artistId } })
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await prisma.fanTier.deleteMany({ where: { artistUserId: artistId } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('detects artist fan-chat offering from tier perks', async () => {
    expect(await artistOffersFanChat(prisma, artistId)).toBe(true)
  })

  it('grants fan chat only to active subscribers when perk is configured', async () => {
    expect(await subscriberHasFanChat(prisma, artistId, fanId)).toBe(false)

    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanId,
        tierName: 'Insider',
        amountCents: 500,
        stripeSubscriptionId: 'sub_fan_perks',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    })
    expect(await subscriberHasFanChat(prisma, artistId, fanId)).toBe(true)
  })

  it('fan-only newsletter send list matches subscriber emails', async () => {
    const sub = await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: `${PREFIX}fan@example.com`,
        confirmedAt: new Date(),
        unsubToken: 'unsub-fan-perks-1',
      },
    })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: 'public@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-fan-perks-2',
      },
    })

    const ids = await fanOnlyNewsletterSubscriberIds(prisma, artistId)
    expect(ids).toEqual([sub.id])
  })
})
