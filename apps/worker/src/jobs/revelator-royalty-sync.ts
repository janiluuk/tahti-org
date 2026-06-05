// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { fetchRoyaltyReports } from '@tahti/revelator'

const SYNCABLE_STATUSES = ['submitted', 'delivered'] as const

export interface RevelatorRoyaltySyncSummary {
  period: string
  releases: number
  upserted: number
}

function priorCalendarMonth(now = new Date()): { year: number; month: number; label: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  return { year, month, label: `${year}-${String(month).padStart(2, '0')}` }
}

function parseYearMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return { year, month }
}

export async function processRevelatorRoyaltySyncJob(
  prisma: PrismaClient,
  job: Job,
): Promise<RevelatorRoyaltySyncSummary> {
  const { yearMonth } = job.data as { yearMonth?: string }
  const period = yearMonth ? parseYearMonth(yearMonth) : priorCalendarMonth()
  if (!period) throw new Error(`Invalid yearMonth: ${yearMonth}`)

  const label = yearMonth ?? `${period.year}-${String(period.month).padStart(2, '0')}`

  const releases = await prisma.release.findMany({
    where: {
      revelatorId: { not: null },
      revelatorStatus: { in: [...SYNCABLE_STATUSES] },
    },
    select: {
      id: true,
      userId: true,
      revelatorId: true,
    },
  })

  const refs = releases
    .filter((r): r is typeof r & { revelatorId: string } => r.revelatorId != null)
    .map((r) => ({
      tahtiReleaseId: r.id,
      revelatorId: r.revelatorId,
    }))

  const rows = await fetchRoyaltyReports(refs, period)

  let upserted = 0
  for (const row of rows) {
    const release = releases.find((r) => r.id === row.tahtiReleaseId)
    if (!release) continue

    const periodStart = new Date(`${row.periodStart}T00:00:00.000Z`)
    const periodEnd = new Date(`${row.periodEnd}T23:59:59.999Z`)

    await prisma.revelatorRoyaltyReport.upsert({
      where: {
        releaseId_periodStart_periodEnd: {
          releaseId: row.tahtiReleaseId,
          periodStart,
          periodEnd,
        },
      },
      create: {
        userId: release.userId,
        releaseId: row.tahtiReleaseId,
        revelatorId: row.revelatorId,
        periodStart,
        periodEnd,
        amountCents: row.amountCents,
        currency: row.currency,
        streams: row.streams,
      },
      update: {
        amountCents: row.amountCents,
        currency: row.currency,
        streams: row.streams,
        syncedAt: new Date(),
      },
    })
    upserted += 1
  }

  return { period: label, releases: refs.length, upserted }
}
