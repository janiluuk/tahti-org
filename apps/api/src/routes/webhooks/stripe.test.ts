// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'stripe-wh-'

describe('Stripe webhooks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'stripe-wh-artist',
        displayName: 'WH Artist',
        emailVerifiedAt: new Date(),
        stripeConnectAccountId: 'acct_wh_test',
        stripeConnectChargesEnabled: false,
        membership: { create: { status: 'PENDING_PAYMENT' } },
        channel: {
          create: {
            slug: 'stripe-wh-artist',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    artistId = artist.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('account.updated syncs charges_enabled on the matching user', async () => {
    const payload = JSON.stringify({
      type: 'account.updated',
      data: { object: { id: 'acct_wh_test', charges_enabled: true } },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload,
    })
    expect(res.statusCode).toBe(200)

    const user = await prisma.user.findUnique({ where: { id: artistId } })
    expect(user?.stripeConnectChargesEnabled).toBe(true)
  })

  it('checkout.session.completed activates membership from metadata', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'stripe-wh-member',
      membershipStatus: 'PENDING_PAYMENT',
    })

    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_membership_test',
          amount_total: 4000,
          metadata: { type: 'membership', userId: member.id },
        },
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload,
    })
    expect(res.statusCode).toBe(200)

    const updated = await prisma.user.findUnique({
      where: { id: member.id },
      include: { membership: true },
    })
    expect(updated?.isMember).toBe(true)
    expect(updated?.membership?.status).toBe('ACTIVE')
    expect(updated?.memberNumber).toBeTruthy()

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { externalRef: 'membership:cs_membership_test' },
    })
    expect(ledger?.category).toBe('REVENUE_SUBSCRIPTION')
  })

  it('customer.subscription.deleted marks subscription canceled', async () => {
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}canceled@example.com`,
      username: 'stripe-wh-fan',
    })
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_to_cancel',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_to_cancel' } },
      }),
    })
    expect(res.statusCode).toBe(200)

    const updated = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(updated?.state).toBe('CANCELED')
    expect(updated?.canceledAt).not.toBeNull()
  })
})
