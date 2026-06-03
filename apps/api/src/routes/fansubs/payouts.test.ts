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

const PREFIX = 'fan-payouts-api-'

describe('GET /api/me/fan-sub-payouts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'fan-payouts-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98630,
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'fan-payouts-fan',
    })
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: 'sub_payout_test',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
    await prisma.fanSubPayout.create({
      data: {
        fanSubscriptionId: sub.id,
        artistUserId: artistId,
        forPeriodStart: new Date('2026-05-01'),
        forPeriodEnd: new Date('2026-06-01'),
        grossCents: 500,
        stripeFeeCents: 30,
        orgFeeCents: 10,
        netToArtistCents: 460,
        state: 'PENDING',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns payout summary and recent rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/fan-sub-payouts',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.pending).toBeGreaterThanOrEqual(1)
    expect(body.activeSubscribers).toBeGreaterThanOrEqual(1)
    expect(body.recent.length).toBeGreaterThanOrEqual(1)
  })

  it('exports fan subscribers as CSV for GDPR', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/fan-subscribers/export.csv',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body).toContain('fan-payouts-api-fan@example.com')
    expect(res.body).toContain('Supporter')
  })
})
