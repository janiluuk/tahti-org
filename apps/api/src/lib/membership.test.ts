// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { activateMembership, recordMembershipRenewal } from './membership.js'
import { hashPassword } from './password.js'

const PREFIX = 'lib-mship-'

describe('activateMembership', () => {
  beforeAll(async () => {
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { externalRef: { startsWith: 'membership:' } },
          { externalRef: { startsWith: 'membership-invoice:' } },
        ],
      },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { externalRef: { startsWith: 'membership:' } },
          { externalRef: { startsWith: 'membership-invoice:' } },
        ],
      },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('activates user, assigns member number, and writes ledger once', async () => {
    const passwordHash = await hashPassword('x')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}a@example.com`,
        passwordHash,
        username: 'lib-mship-a',
        displayName: 'A',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'PENDING_PAYMENT' } },
      },
    })

    const r1 = await activateMembership(prisma, user.id, {
      stripeSessionId: 'cs_lib_1',
      amountCents: 4000,
    })
    expect(r1.alreadyActive).toBe(false)
    expect(r1.memberNumber).toBeGreaterThan(0)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.isMember).toBe(true)
    expect(updated?.tier).toBe('ARTIST')

    const r2 = await activateMembership(prisma, user.id, {
      stripeSessionId: 'cs_lib_2',
    })
    expect(r2.alreadyActive).toBe(true)

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { externalRef: 'membership:cs_lib_1' },
    })
    expect(ledgerCount).toBe(1)
  })

  it('skips ledger when subscription checkout defers to invoice.paid', async () => {
    const passwordHash = await hashPassword('x')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}sub@example.com`,
        passwordHash,
        username: 'lib-mship-sub',
        displayName: 'Sub',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'PENDING_PAYMENT' } },
      },
    })

    await activateMembership(prisma, user.id, {
      stripeSessionId: 'cs_sub_1',
      stripeSubscriptionId: 'sub_membership_1',
      recordLedger: false,
    })

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { externalRef: 'membership:cs_sub_1' },
    })
    expect(ledgerCount).toBe(0)

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.stripeMembershipSubscriptionId).toBe('sub_membership_1')
  })
})

describe('recordMembershipRenewal', () => {
  beforeAll(async () => {
    await prisma.ledgerEntry.deleteMany({
      where: { externalRef: { startsWith: 'membership-invoice:' } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: `${PREFIX}renew` } } })
  })

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({
      where: { externalRef: { startsWith: 'membership-invoice:' } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: `${PREFIX}renew` } } })
  })

  it('reactivates lapsed member and records invoice ledger once', async () => {
    const passwordHash = await hashPassword('x')
    const memberSince = new Date('2024-01-01T00:00:00.000Z')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}renew@example.com`,
        passwordHash,
        username: 'lib-mship-renew',
        displayName: 'Renew',
        emailVerifiedAt: new Date(),
        isMember: false,
        tier: 'FREE',
        memberNumber: 42,
        memberSince,
        stripeMembershipSubscriptionId: 'sub_renew_1',
        membership: { create: { status: 'SUSPENDED', activatedAt: memberSince } },
      },
    })

    const periodStart = new Date('2025-01-01T00:00:00.000Z')
    await recordMembershipRenewal(prisma, user.id, {
      stripeInvoiceId: 'in_renew_1',
      amountCents: 4000,
      stripeSubscriptionId: 'sub_renew_1',
      periodStart,
    })

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.isMember).toBe(true)
    expect(updated?.tier).toBe('ARTIST')
    expect(updated?.memberSince?.toISOString()).toBe(periodStart.toISOString())

    const ledgerCount = await prisma.ledgerEntry.count({
      where: { externalRef: 'membership-invoice:in_renew_1' },
    })
    expect(ledgerCount).toBe(1)

    await recordMembershipRenewal(prisma, user.id, {
      stripeInvoiceId: 'in_renew_1',
      amountCents: 4000,
      stripeSubscriptionId: 'sub_renew_1',
      periodStart,
    })
    expect(
      await prisma.ledgerEntry.count({
        where: { externalRef: 'membership-invoice:in_renew_1' },
      }),
    ).toBe(1)
  })
})
