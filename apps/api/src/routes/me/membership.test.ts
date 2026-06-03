// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'

const PREFIX = 'mship-test-'

describe('M1 — membership payment', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { startsWith: 'membership:' } } })
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { startsWith: PREFIX } }, { username: { startsWith: 'mship-' } }],
      },
    })

    const passwordHash = await hashPassword('testpassword')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}user@example.com`,
        passwordHash,
        username: 'mship-test-user',
        displayName: 'Member Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'PENDING_PAYMENT' } },
        channel: {
          create: {
            slug: 'mship-test-user',
            liveSourceMount: '/live/mship-test-user',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'mship-test-user__x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    userId = user.id
    cookie = `tahti_session=${(await createSession(prisma, user.id)).id}`
  })

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { startsWith: 'membership:' } } })
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { startsWith: PREFIX } }, { username: { startsWith: 'mship-' } }],
      },
    })
    await app.close()
  })

  it('reports pending payment before checkout', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/membership',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PENDING_PAYMENT')
    expect(res.json().isMember).toBe(false)
    expect(res.json().priceCents).toBe(4000)
  })

  it('activates membership and records ledger entry (dev checkout)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/membership/checkout',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().activated).toBe(true)
    expect(res.json().memberNumber).toBeGreaterThan(0)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    expect(user?.isMember).toBe(true)
    expect(user?.tier).toBe('ARTIST')

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { externalRef: { startsWith: 'membership:' } },
    })
    expect(ledger?.category).toBe('REVENUE_SUBSCRIPTION')
    expect(Number(ledger?.amountCents)).toBe(4000)
  })

  it('rejects duplicate checkout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/membership/checkout',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('webhook checkout.session.completed is idempotent', async () => {
    const passwordHash = await hashPassword('testpassword')
    const pending = await prisma.user.create({
      data: {
        email: `${PREFIX}webhook@example.com`,
        passwordHash,
        username: 'mship-webhook',
        displayName: 'Webhook Test',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'PENDING_PAYMENT' } },
        channel: {
          create: {
            slug: 'mship-webhook',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'mship-webhook__x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })

    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_membership',
          amount_total: 4000,
          metadata: { type: 'membership', userId: pending.id },
        },
      },
    })

    const first = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload,
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload,
    })
    expect(second.statusCode).toBe(200)

    const count = await prisma.ledgerEntry.count({
      where: { externalRef: 'membership:cs_test_membership' },
    })
    expect(count).toBe(1)

    await prisma.user.delete({ where: { id: pending.id } })
  })

  it('webhook returns received when membership user is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_missing_user',
            amount_total: 4000,
            metadata: { type: 'membership', userId: 'nonexistent' },
          },
        },
      }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
  })
})

describe('M1 — verify sets PENDING_PAYMENT', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => app.close())

  it('does not activate membership on email verify alone', async () => {
    const passwordHash = await hashPassword('pass')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}verify@example.com`,
        passwordHash,
        username: 'mship-verify-only',
        displayName: 'Verify Only',
        membership: { create: {} },
        channel: {
          create: {
            slug: 'mship-verify-only',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'mship-verify-only__x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    const token = generateVerificationToken()
    await prisma.emailVerification.create({
      data: { userId: user.id, token, expiresAt: verificationExpiresAt() },
    })

    const res = await app.inject({ method: 'GET', url: `/api/auth/verify?token=${token}` })
    expect(res.statusCode).toBe(200)

    const membership = await prisma.membership.findUnique({ where: { userId: user.id } })
    expect(membership?.status).toBe('PENDING_PAYMENT')

    await prisma.user.delete({ where: { id: user.id } })
  })
})
