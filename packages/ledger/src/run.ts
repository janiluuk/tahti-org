// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { allocateGrants, type ArtistUnits } from './allocate.js'

export interface AnnualGrantSummary {
  forYear: number
  alreadyRun: boolean
  surplusCents: number
  reserveCents: number
  poolCents: number
  totalUnits: number
  grantCount: number
  unallocatedCents: number
}

export interface ArtistEngagement extends ArtistUnits {
  /** Counted downloads with weight 1 (free downloads ×1). */
  freeDownloads: number
  /** Counted downloads with weight 5 (paid/fan-sub downloads ×5). */
  paidDownloads: number
  /** Whole euros of gross fan-sub revenue received for the year. */
  fanSubEuros: number
}

// Sum eligible engagement units per artist for the fiscal year, per the v6
// formula (docs/engagement-and-fansubs.md):
//   units = counted-download weight (free ×1, paid fan-sub ×5)
//         + fan_sub_euros_received (1 unit per euro of gross fan-sub revenue)
export async function computeEngagementUnits(
  prisma: PrismaClient,
  year: number,
): Promise<ArtistEngagement[]> {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  const units = new Map<string, number>()
  const free = new Map<string, number>()
  const paid = new Map<string, number>()
  const fanSub = new Map<string, number>()

  // Downloads → weighted units, keyed by channel → artist, split free (×1) vs paid (×5).
  const grouped = await prisma.download.groupBy({
    by: ['channelId', 'weight'],
    where: { countedAt: { gte: start, lt: end } },
    _count: true,
  })
  if (grouped.length > 0) {
    const channels = await prisma.channel.findMany({
      where: { id: { in: [...new Set(grouped.map((g) => g.channelId))] } },
      select: { id: true, userId: true },
    })
    const channelToUser = new Map(channels.map((c) => [c.id, c.userId]))
    for (const g of grouped) {
      const userId = channelToUser.get(g.channelId)
      if (!userId) continue
      units.set(userId, (units.get(userId) ?? 0) + g.weight * g._count)
      if (g.weight === 1) {
        free.set(userId, (free.get(userId) ?? 0) + g._count)
      } else {
        paid.set(userId, (paid.get(userId) ?? 0) + g._count)
      }
    }
  }

  // Fan-sub euros received → 1 unit per euro of gross (€/12 per month).
  const fanSubGross = await prisma.fanSubPayout.groupBy({
    by: ['artistUserId'],
    where: { forPeriodStart: { gte: start, lt: end } },
    _sum: { grossCents: true },
  })
  for (const g of fanSubGross) {
    const euros = Math.floor((g._sum.grossCents ?? 0) / 100)
    if (euros <= 0) continue
    units.set(g.artistUserId, (units.get(g.artistUserId) ?? 0) + euros)
    fanSub.set(g.artistUserId, euros)
  }

  return [...units.entries()].map(([userId, totalUnits]) => ({
    userId,
    units: totalUnits,
    freeDownloads: free.get(userId) ?? 0,
    paidDownloads: paid.get(userId) ?? 0,
    fanSubEuros: fanSub.get(userId) ?? 0,
  }))
}

export interface RunOptions {
  reservePct?: number
  minUnits?: number
}

// Computes and persists the annual grant disbursements for a fiscal year.
// Idempotent: refuses to re-run a year that already has disbursements (the
// ledger is append-only — corrections are made with offsetting entries).
export async function runAnnualGrantCalc(
  prisma: PrismaClient,
  year: number,
  opts: RunOptions = {},
): Promise<AnnualGrantSummary> {
  const existing = await prisma.grantDisbursement.count({ where: { forYear: year } })
  if (existing > 0) {
    return {
      forYear: year,
      alreadyRun: true,
      surplusCents: 0,
      reserveCents: 0,
      poolCents: 0,
      totalUnits: 0,
      grantCount: 0,
      unallocatedCents: 0,
    }
  }

  const rollups = await prisma.monthlyRollup.findMany({
    where: { yearMonth: { startsWith: `${year}-` } },
    select: { surplus: true },
  })
  const surplusCents = rollups.reduce((s, r) => s + Number(r.surplus), 0)

  const artists = await computeEngagementUnits(prisma, year)

  const result = allocateGrants({
    surplusCents,
    reservePct: opts.reservePct,
    minUnits: opts.minUnits,
    artists,
  })

  if (result.allocations.length === 0) {
    return {
      forYear: year,
      alreadyRun: false,
      surplusCents: result.surplusCents,
      reserveCents: result.reserveCents,
      poolCents: result.poolCents,
      totalUnits: result.totalUnits,
      grantCount: 0,
      unallocatedCents: result.unallocatedCents,
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: result.allocations.map((a) => a.userId) } },
    select: { id: true, displayName: true, memberNumber: true, publicAttribution: true },
  })
  const userMeta = new Map(users.map((u) => [u.id, u]))

  const periodStart = new Date(Date.UTC(year, 0, 1))
  const periodEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

  await prisma.$transaction(async (tx) => {
    for (const alloc of result.allocations) {
      const meta = userMeta.get(alloc.userId)
      const publishedAs =
        meta?.publicAttribution && meta.displayName
          ? meta.displayName
          : `Channel #${meta?.memberNumber ?? '—'}`

      await tx.grantDisbursement.create({
        data: {
          userId: alloc.userId,
          forYear: year,
          units: alloc.units,
          amountCents: BigInt(alloc.amountCents),
          state: 'PENDING',
          publishedAs,
        },
      })

      await tx.ledgerEntry.create({
        data: {
          category: 'GRANT_DISBURSEMENT',
          amountCents: BigInt(alloc.amountCents),
          description: `Artist grant ${year} — ${publishedAs}`,
          externalRef: `grant:${year}:${alloc.userId}`,
          periodStart,
          periodEnd,
          createdBy: 'system',
        },
      })
    }

    if (result.reserveCents > 0) {
      await tx.ledgerEntry.create({
        data: {
          category: 'RESERVE_TRANSFER',
          amountCents: BigInt(result.reserveCents),
          description: `Operating reserve (10%) for ${year} grant pool`,
          externalRef: `reserve:${year}`,
          periodStart,
          periodEnd,
          createdBy: 'system',
        },
      })
    }
  })

  return {
    forYear: year,
    alreadyRun: false,
    surplusCents: result.surplusCents,
    reserveCents: result.reserveCents,
    poolCents: result.poolCents,
    totalUnits: result.totalUnits,
    grantCount: result.allocations.length,
    unallocatedCents: result.unallocatedCents,
  }
}
