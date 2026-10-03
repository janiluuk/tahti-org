// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import * as membership from '../../lib/membership.js'

vi.mock('../../lib/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/email.js')>()),
  sendMail: vi.fn().mockResolvedValue(undefined),
}))

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

  it('checkout.session.completed records distribution payment and ledger', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}dist@example.com`,
      username: 'stripe-wh-dist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98450,
    })
    const release = await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Webhook EP',
        type: 'EP',
        releaseDate: new Date('2026-06-01'),
        smartLinkSlug: `${PREFIX}webhook-slug`,
      },
    })

    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_distribution_test',
          amount_total: 800,
          metadata: {
            type: 'distribution',
            releaseId: release.id,
            userId: artist.id,
          },
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

    const row = await prisma.release.findUnique({ where: { id: release.id } })
    expect(row?.distributionPaidAt).toBeTruthy()
    expect(row?.distributionFeeCents).toBe(800)

    const revenue = await prisma.ledgerEntry.findFirst({
      where: { externalRef: 'distribution:cs_distribution_test' },
    })
    expect(revenue?.category).toBe('REVENUE_DISTRIBUTION')
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

  it('customer.subscription.updated keeps a cancel-at-period-end subscription canceled, then a renew reactivates it', async () => {
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}period-end@example.com`,
      username: 'stripe-wh-period-end',
    })
    const canceledAt = new Date(Date.now() - 60_000)
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_period_end',
        state: 'CANCELED',
        canceledAt,
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
    })
    const updated = (cancelAtPeriodEnd: boolean) =>
      app.inject({
        method: 'POST',
        url: '/api/webhooks/stripe',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_period_end',
              status: 'active',
              cancel_at_period_end: cancelAtPeriodEnd,
              current_period_end: Math.floor(Date.now() / 1000) + 10 * 24 * 3600,
              metadata: {
                artistUserId: artistId,
                subscriberUserId: fan.id,
                tierName: 'Backer',
                amountCents: '500',
              },
            },
          },
        }),
      })

    expect((await updated(true)).statusCode).toBe(200)
    const stillCanceled = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(stillCanceled?.state).toBe('CANCELED')
    expect(stillCanceled?.canceledAt?.getTime()).toBe(canceledAt.getTime())

    expect((await updated(false)).statusCode).toBe(200)
    const renewed = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(renewed?.state).toBe('ACTIVE')
    expect(renewed?.canceledAt).toBeNull()
  })

  it('customer.subscription.updated marks a portal cancel on an active subscription', async () => {
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}portal-cancel@example.com`,
      username: 'stripe-wh-portal-cancel',
    })
    const sub = await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_portal_cancel',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_portal_cancel',
            status: 'active',
            cancel_at_period_end: true,
            current_period_end: Math.floor(Date.now() / 1000) + 10 * 24 * 3600,
            metadata: {
              artistUserId: artistId,
              subscriberUserId: fan.id,
              tierName: 'Backer',
              amountCents: '500',
            },
          },
        },
      }),
    })
    expect(res.statusCode).toBe(200)

    const row = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(row?.state).toBe('CANCELED')
    expect(row?.canceledAt).not.toBeNull()
  })

  it('invoice.payment_failed tells the fan once a day', async () => {
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}failed@example.com`,
      username: 'stripe-wh-failed-fan',
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fan.id,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId: 'sub_payment_failed',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 24 * 3600 * 1000),
      },
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/stripe',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          type: 'invoice.payment_failed',
          data: { object: { id: `in_failed_${attempt}`, subscription: 'sub_payment_failed' } },
        }),
      })
      expect(res.statusCode).toBe(200)
    }

    const notes = await prisma.notification.findMany({
      where: { userId: fan.id, type: 'FAN_SUB_PAYMENT_FAILED' },
      select: { title: true, url: true },
    })
    expect(notes).toEqual([
      { title: "Your payment for WH Artist's Backer subscription failed", url: '/account' },
    ])
  })

  it('writes audit dead-letter when a handler throws', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}deadletter@example.com`,
      username: 'stripe-wh-deadletter',
      membershipStatus: 'PENDING_PAYMENT',
    })

    const spy = vi
      .spyOn(membership, 'activateMembership')
      .mockRejectedValueOnce(new Error('simulated handler failure'))

    const payload = JSON.stringify({
      id: 'evt_deadletter_test',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_deadletter_test',
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
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ received: false })

    const deadLetter = await prisma.auditLog.findFirst({
      where: { action: 'STRIPE_WEBHOOK_ERROR', targetId: 'evt_deadletter_test' },
    })
    expect(deadLetter).toBeTruthy()
    expect(deadLetter?.meta).toMatchObject({
      eventType: 'checkout.session.completed',
      message: 'simulated handler failure',
    })

    spy.mockRestore()
  })
})
