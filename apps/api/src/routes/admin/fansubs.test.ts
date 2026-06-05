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

const PREFIX = 'admin-fansubs-'

describe('M21-D — admin fansubs API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let payoutId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-fs-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-fs-artist',
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'admin-fs-fan',
    })

    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `${PREFIX}sub`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
    })

    const payout = await prisma.fanSubPayout.create({
      data: {
        fanSubscriptionId: sub.id,
        artistUserId: artist.id,
        forPeriodStart: new Date('2026-05-01'),
        forPeriodEnd: new Date('2026-06-01'),
        grossCents: 500,
        stripeFeeCents: 50,
        orgFeeCents: 50,
        netToArtistCents: 400,
        state: 'FAILED',
      },
    })
    payoutId = payout.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/admin/fansubs/overview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/fansubs/overview',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { activeFanSubCount: number; failedPayouts: { count: number } }
    expect(body.activeFanSubCount).toBeGreaterThanOrEqual(1)
    expect(body.failedPayouts.count).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/admin/fansubs/payouts lists FAILED rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/fansubs/payouts?state=FAILED',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { payouts: Array<{ id: string }> }
    expect(body.payouts.some((p) => p.id === payoutId)).toBe(true)
  })

  it('POST retry requeues FAILED payout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/fansubs/payouts/${payoutId}/retry`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, state: 'PENDING' })

    const row = await prisma.fanSubPayout.findUnique({ where: { id: payoutId } })
    expect(row?.state).toBe('PENDING')
  })
})
