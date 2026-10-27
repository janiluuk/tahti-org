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

const PREFIX = 'export-grants-'

describe('GET /api/me/data-export.json — grants and payouts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.grantDisbursement.create({
      data: {
        userId: artist.id,
        forYear: 2032,
        units: 60,
        amountCents: BigInt(54_000),
        publishedAs: 'Artist A',
      },
    })
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `dev_${PREFIX}${fan.id}`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date('2026-12-01T00:00:00Z'),
      },
    })
    await prisma.fanSubPayout.create({
      data: {
        fanSubscriptionId: sub.id,
        artistUserId: artist.id,
        forPeriodStart: new Date('2026-10-01T00:00:00Z'),
        forPeriodEnd: new Date('2026-11-01T00:00:00Z'),
        grossCents: 500,
        stripeFeeCents: 40,
        orgFeeCents: 10,
        netToArtistCents: 450,
      },
    })
  })

  afterAll(async () => {
    await prisma.grantDisbursement.deleteMany({ where: { forYear: 2032 } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the grants awarded and the payouts received', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grants).toEqual([
      expect.objectContaining({ forYear: 2032, units: 60, amountCents: 54_000, state: 'PENDING' }),
    ])
    expect(body.fanSubscriptionPayouts).toEqual([
      expect.objectContaining({ grossCents: 500, netToArtistCents: 450 }),
    ])
  })
})
