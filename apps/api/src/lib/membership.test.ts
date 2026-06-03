// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { activateMembership } from './membership.js'
import { hashPassword } from './password.js'

const PREFIX = 'lib-mship-'

describe('activateMembership', () => {
  beforeAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { startsWith: 'membership:' } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { startsWith: 'membership:' } } })
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
})
