// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { sendWorkerMail } = vi.hoisted(() => ({
  sendWorkerMail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./mailer.js', () => ({ sendWorkerMail, APP_URL: 'https://app.test' }))

import { prisma } from '@tahti/db'
import { processFanSubPayoutsJob } from '../jobs/fan-sub-payout.js'

const PREFIX = 'payout-notice-'

describe('payout notices', () => {
  let artistId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        username: `${PREFIX}artist`,
        displayName: 'Paid Artist',
        passwordHash: 'x',
        emailVerifiedAt: new Date(),
        stripeConnectAccountId: 'acct_test',
        stripeConnectChargesEnabled: true,
      },
    })
    artistId = artist.id
    for (const n of [1, 2]) {
      const fan = await prisma.user.create({
        data: {
          email: `${PREFIX}fan${n}@example.com`,
          username: `${PREFIX}fan${n}`,
          displayName: 'Fan',
          passwordHash: 'x',
        },
      })
      const sub = await prisma.fanSubscription.create({
        data: {
          artistUserId: artist.id,
          subscriberUserId: fan.id,
          tierName: 'Insider',
          amountCents: 500,
          stripeSubscriptionId: `${PREFIX}sub-${n}`,
          state: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        },
      })
      await prisma.fanSubPayout.create({
        data: {
          fanSubscriptionId: sub.id,
          artistUserId: artist.id,
          forPeriodStart: new Date(),
          forPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          grossCents: 500,
          stripeFeeCents: 40,
          orgFeeCents: 10,
          netToArtistCents: 450,
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.fanSubPayout.deleteMany({ where: { artistUserId: artistId } })
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('tells the artist once per run how much was paid out', async () => {
    await processFanSubPayoutsJob(prisma)
    const notes = await prisma.notification.findMany({
      where: { userId: artistId, type: 'PAYOUT_SENT' },
      select: { title: true, body: true, url: true },
    })
    expect(notes).toEqual([
      {
        title: '€9.00 paid out to you',
        body: 'From 2 fan subscription payments',
        url: '/studio/revenue',
      },
    ])
    const mail = sendWorkerMail.mock.calls
      .map(([m]) => m as { to: string; subject: string })
      .filter((m) => m.to === `${PREFIX}artist@example.com`)
    expect(mail.map((m) => m.subject)).toEqual(['Tahti · €9.00 paid out to you'])

    await processFanSubPayoutsJob(prisma)
    expect(
      await prisma.notification.count({ where: { userId: artistId, type: 'PAYOUT_SENT' } }),
    ).toBe(1)
  })
})
