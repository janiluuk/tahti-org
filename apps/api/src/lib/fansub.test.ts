// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { hashPassword } from './password.js'
import {
  isActiveFanSubscriber,
  expireLapsedFanSubscriptions,
  markFanSubCanceledAtPeriodEnd,
} from './fansub.js'

const PREFIX = 'fansub-lib-'

describe('fansub lifecycle helpers', () => {
  let artistId: string
  let fanId: string

  beforeAll(async () => {
    await prisma.fanSubscription.deleteMany({
      where: { artist: { email: { startsWith: PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'fansub-lib-artist',
        displayName: 'Artist',
        emailVerifiedAt: new Date(),
      },
    })
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'fansub-lib-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })
    artistId = artist.id
    fanId = fan.id
  })

  afterAll(async () => {
    await prisma.fanSubscription.deleteMany({
      where: { artistUserId: artistId },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('treats CANCELED subs as active until period end + 7 days', async () => {
    const periodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanId,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_grace_test',
        state: 'CANCELED',
        currentPeriodEnd: periodEnd,
        canceledAt: new Date(),
      },
    })

    expect(await isActiveFanSubscriber(prisma, artistId, fanId)).toBe(true)

    await prisma.fanSubscription.update({
      where: { artistUserId_subscriberUserId: { artistUserId: artistId, subscriberUserId: fanId } },
      data: {
        currentPeriodEnd: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    })
    expect(await isActiveFanSubscriber(prisma, artistId, fanId)).toBe(false)
  })

  it('expireLapsedFanSubscriptions closes ACTIVE past period and CANCELED past grace', async () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const pastGrace = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const passwordHash = await hashPassword('testpassword')
    const fan2 = await prisma.user.create({
      data: {
        email: `${PREFIX}fan2@example.com`,
        passwordHash,
        username: 'fansub-lib-fan2',
        displayName: 'Fan 2',
        emailVerifiedAt: new Date(),
      },
    })

    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })

    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanId,
        tierName: 'A',
        amountCents: 500,
        stripeSubscriptionId: 'sub_expire_active',
        state: 'ACTIVE',
        currentPeriodEnd: past,
      },
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan2.id,
        tierName: 'B',
        amountCents: 500,
        stripeSubscriptionId: 'sub_expire_canceled',
        state: 'CANCELED',
        currentPeriodEnd: pastGrace,
        canceledAt: pastGrace,
      },
    })

    const count = await expireLapsedFanSubscriptions(prisma)
    expect(count).toBe(2)

    const rows = await prisma.fanSubscription.findMany({ where: { artistUserId: artistId } })
    expect(rows.every((r) => r.state === 'EXPIRED')).toBe(true)

    await prisma.user.delete({ where: { id: fan2.id } })
  })

  it('markFanSubCanceledAtPeriodEnd sets CANCELED without shortening period', async () => {
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanId,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_mark_cancel',
        state: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
    })

    await markFanSubCanceledAtPeriodEnd(prisma, { subscriptionId: sub.id })
    const updated = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(updated?.state).toBe('CANCELED')
    expect(updated?.currentPeriodEnd.getTime()).toBe(periodEnd.getTime())
    expect(await isActiveFanSubscriber(prisma, artistId, fanId)).toBe(true)
  })
})
