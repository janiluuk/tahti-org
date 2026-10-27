// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { markFanSubCanceledAtPeriodEnd } from '../../lib/fansub.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'fansub-cancel-notice-'

describe('The artist is told when a fan cancels', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let fanCookie: string
  let subId: string
  const periodEnd = new Date('2026-12-01T00:00:00.000Z')

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    await prisma.user.update({ where: { id: artistId }, data: { notifyMoneyMovesInApp: true } })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
      displayName: 'Aino',
    })
    fanCookie = await sessionCookieFor(prisma, fan.id)
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `dev_${PREFIX}${fan.id}`,
        state: 'ACTIVE',
        currentPeriodEnd: periodEnd,
      },
    })
    subId = sub.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies once, even when Stripe confirms the cancel afterwards', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/subscriptions/${subId}/cancel`,
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    await markFanSubCanceledAtPeriodEnd(prisma, { subscriptionId: subId })

    const notices = await prisma.notification.findMany({
      where: { userId: artistId, type: 'FAN_SUB_CANCELED' },
    })
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      title: 'Aino cancelled their Supporter subscription (perks until 2026-12-01)',
      url: '/studio/revenue',
    })
  })
})
