// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import {
  countStudioIncludedUsedThisYear,
  getDistributionBillingStatus,
  recordDistributionPayment,
} from './distribution-billing.js'

const PREFIX = 'distribution-billing-'

describe('distribution-billing', () => {
  let userId: string
  let releaseId: string

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('records revenue and pass-through ledger entries', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash: 'hash',
        username: `${PREFIX}artist`,
        displayName: 'Billing Artist',
        tier: 'ARTIST',
      },
    })
    userId = user.id

    const release = await prisma.release.create({
      data: {
        userId,
        title: 'Paid EP',
        type: 'EP',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `${PREFIX}slug`,
      },
    })
    releaseId = release.id

    const result = await recordDistributionPayment(prisma, {
      releaseId,
      userId,
      amountCents: 800,
      stripeSessionId: 'cs_test_distribution_1',
    })
    expect(result.alreadyPaid).toBe(false)

    const row = await prisma.release.findUnique({ where: { id: releaseId } })
    expect(row?.distributionPaidAt).toBeTruthy()
    expect(row?.distributionFeeCents).toBe(800)

    const entries = await prisma.ledgerEntry.findMany({
      where: { externalRef: { startsWith: 'distribution:cs_test_distribution_1' } },
    })
    expect(entries.some((e) => e.category === 'REVENUE_DISTRIBUTION')).toBe(true)
    expect(entries.some((e) => e.category === 'COST_DISTRIBUTION_PASSTHROUGH')).toBe(true)
  })

  it('offers zero fee while Studio included slots remain', async () => {
    const status = await getDistributionBillingStatus(prisma, userId, 'STUDIO', {
      distributionPaidAt: null,
      distributionFeeCents: null,
    })
    expect(status.feeCents).toBe(0)
    expect(status.studioIncludedRemaining).toBeGreaterThan(0)
  })

  it('counts studio waivers used this year', async () => {
    const used = await countStudioIncludedUsedThisYear(prisma, userId)
    expect(used).toBe(0)
  })
})
