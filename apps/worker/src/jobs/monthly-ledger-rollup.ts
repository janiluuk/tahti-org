// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Runs on the first day of each month to aggregate the prior month's
// ledger entries into MonthlyRollup.

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'

export async function processMonthlyLedgerRollup(job: Job): Promise<void> {
  const { yearMonth } = job.data as { yearMonth?: string }

  // Default to prior month
  const now = new Date()
  const targetDate = yearMonth
    ? new Date(`${yearMonth}-01`)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const ym = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
  const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
  const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999)

  console.log(`[worker] monthly-ledger-rollup: processing ${ym}`)

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      periodStart: { gte: monthStart },
      periodEnd: { lte: monthEnd },
    },
    select: { category: true, amountCents: true },
  })

  const byCategory: Record<string, string> = {}
  let totalRevenue = 0n
  let totalCosts = 0n

  for (const entry of entries) {
    const prev = BigInt(byCategory[entry.category] ?? '0')
    byCategory[entry.category] = (prev + entry.amountCents).toString()

    if (entry.category.startsWith('REVENUE_')) {
      totalRevenue += entry.amountCents
    } else if (entry.category.startsWith('COST_')) {
      totalCosts += entry.amountCents
    }
  }

  const surplus = totalRevenue - totalCosts

  await prisma.monthlyRollup.upsert({
    where: { yearMonth: ym },
    create: { yearMonth: ym, byCategory, surplus, finalizedAt: new Date() },
    update: { byCategory, surplus, finalizedAt: new Date() },
  })

  console.log(`[worker] monthly-ledger-rollup: ${ym} surplus=${surplus} entries=${entries.length}`)
}
