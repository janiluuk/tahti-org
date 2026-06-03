// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { processFanSubPayouts } from '@tahti/ledger'
import { processFanSubExpire } from '../../../../worker/src/jobs/fan-sub-expire.js'
import { cleanupUsersByEmailPrefix } from '../../test/helpers.js'
import { hashPassword } from '../../lib/password.js'

const PREFIX = 'fansub-payout-test-'

describe('M19 — fan-sub payout and churn crons', () => {
  let artistId: string
  let payoutId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const passwordHash = await hashPassword('testpassword')

    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'fansub-payout-artist',
        displayName: 'Payout Artist',
        emailVerifiedAt: new Date(),
        isMember: true,
        stripeConnectAccountId: 'acct_test_connect',
        stripeConnectChargesEnabled: true,
      },
    })
    artistId = artist.id

    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'fansub-payout-fan',
        displayName: 'Payout Fan',
        emailVerifiedAt: new Date(),
        isMember: true,
      },
    })

    const lapsedFan = await prisma.user.create({
      data: {
        email: `${PREFIX}lapsed@example.com`,
        passwordHash,
        username: 'fansub-payout-lapsed',
        displayName: 'Lapsed Fan',
        emailVerifiedAt: new Date(),
        isMember: true,
      },
    })

    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `sub_${PREFIX}active`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    })

    const payout = await prisma.fanSubPayout.create({
      data: {
        fanSubscriptionId: sub.id,
        artistUserId: artist.id,
        forPeriodStart: new Date('2026-05-01'),
        forPeriodEnd: new Date('2026-06-01'),
        grossCents: 500,
        stripeFeeCents: 25,
        orgFeeCents: 10,
        netToArtistCents: 465,
        state: 'PENDING',
      },
    })
    payoutId = payout.id

    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: lapsedFan.id,
        tierName: 'Lapsed',
        amountCents: 500,
        stripeSubscriptionId: `sub_${PREFIX}lapsed`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date('2020-01-01'),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('marks pending payouts as PAID when Connect is enabled', async () => {
    await processFanSubPayouts(prisma)

    const payout = await prisma.fanSubPayout.findUnique({ where: { id: payoutId } })
    expect(payout?.state).toBe('PAID')
    expect(payout?.paidAt).toBeTruthy()
    expect(payout?.stripeTransferId).toBe('connect_destination')
  })

  it('expires subscriptions past currentPeriodEnd', async () => {
    const before = await prisma.fanSubscription.count({
      where: { artistUserId: artistId, state: 'EXPIRED' },
    })
    await processFanSubExpire(prisma)
    const after = await prisma.fanSubscription.count({
      where: { artistUserId: artistId, state: 'EXPIRED' },
    })
    expect(after).toBeGreaterThan(before)
  })

  it('buildApp still boots with payout routes registered', async () => {
    const app = await buildApp({ logger: false })
    await app.ready()
    await app.close()
  })
})
