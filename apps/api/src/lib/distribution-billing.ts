// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier, PrismaClient } from '@tahti/db'
import { config } from '../config.js'

export interface DistributionBillingStatus {
  paid: boolean
  feeCents: number
  waived: boolean
  studioIncludedRemaining: number | null
  distributionPaidAt: string | null
}

function startOfUtcYear(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
}

export async function countStudioIncludedUsedThisYear(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  const yearStart = startOfUtcYear()
  return prisma.release.count({
    where: {
      userId,
      distributionPaidAt: { gte: yearStart },
      distributionFeeCents: 0,
    },
  })
}

export async function getDistributionBillingStatus(
  prisma: PrismaClient,
  userId: string,
  tier: ArtistTier,
  release: { distributionPaidAt: Date | null; distributionFeeCents: number | null },
): Promise<DistributionBillingStatus> {
  const paid = release.distributionPaidAt != null
  const studioIncludedPerYear = config.distribution.studioIncludedPerYear
  let studioIncludedRemaining: number | null = null

  if (tier === 'STUDIO') {
    const used = await countStudioIncludedUsedThisYear(prisma, userId)
    studioIncludedRemaining = Math.max(0, studioIncludedPerYear - used)
  }

  const feeCents =
    tier === 'STUDIO' && studioIncludedRemaining != null && studioIncludedRemaining > 0 && !paid
      ? 0
      : config.distribution.artistFeeCents

  return {
    paid,
    feeCents,
    waived: paid && release.distributionFeeCents === 0,
    studioIncludedRemaining,
    distributionPaidAt: release.distributionPaidAt?.toISOString() ?? null,
  }
}

export async function recordDistributionPayment(
  prisma: PrismaClient,
  opts: {
    releaseId: string
    userId: string
    amountCents: number
    stripeSessionId: string
    passThroughCents?: number
  },
) {
  const passThroughCents = opts.passThroughCents ?? config.distribution.passThroughCents
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findFirst({
      where: { id: opts.releaseId, userId: opts.userId },
      select: { id: true, distributionPaidAt: true, title: true },
    })
    if (!release) throw new Error('Release not found')
    if (release.distributionPaidAt) {
      return { alreadyPaid: true as const, releaseId: release.id }
    }

    await tx.release.update({
      where: { id: release.id },
      data: {
        distributionFeeCents: opts.amountCents,
        distributionPaidAt: now,
        distributionStripeSessionId: opts.stripeSessionId,
      },
    })

    const ref = `distribution:${opts.stripeSessionId}`
    const existing = await tx.ledgerEntry.findFirst({ where: { externalRef: ref } })
    if (!existing && opts.amountCents > 0) {
      await tx.ledgerEntry.createMany({
        data: [
          {
            category: 'REVENUE_DISTRIBUTION',
            amountCents: BigInt(opts.amountCents),
            description: `DSP distribution fee (${release.title})`,
            externalRef: ref,
            periodStart: now,
            periodEnd,
            createdBy: 'system',
          },
          {
            category: 'COST_DISTRIBUTION_PASSTHROUGH',
            amountCents: BigInt(-passThroughCents),
            description: `Revelator pass-through (${release.title})`,
            externalRef: `${ref}:cost`,
            periodStart: now,
            periodEnd,
            createdBy: 'system',
          },
        ],
      })
    }

    return { alreadyPaid: false as const, releaseId: release.id }
  })
}
