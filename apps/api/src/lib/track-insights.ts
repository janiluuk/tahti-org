// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M37: per-track "Show insights" — country breakdown + daily downloads for a
// single ArchiveItem or ReleaseTrack, time-filterable. "Plays" mirrors the
// platform-wide convention elsewhere (artist-stats.ts): there is no separate
// play-event log, so plays === counted downloads at track granularity (no
// per-track smart-link click data exists to add on top, unlike the
// channel-wide stat).

import type { PrismaClient } from '@tahti/db'
import { countryDisplayName } from './geoip.js'

export type InsightsPeriod = '7d' | '30d' | 'all'

function sinceDateFor(period: InsightsPeriod): Date | undefined {
  if (period === 'all') return undefined
  return new Date(Date.now() - (period === '7d' ? 7 : 30) * 86_400_000)
}

function utcDaysBack(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

async function buildInsights(
  prisma: PrismaClient,
  trackWhere: { archiveItemId: string } | { releaseTrackId: string },
  period: InsightsPeriod,
  title: string,
) {
  const since = sinceDateFor(period)
  const dateFilter = since ? { createdAt: { gte: since } } : {}

  const [totalDownloads, countryRows, dailyRows] = await Promise.all([
    prisma.download.count({
      where: { ...trackWhere, countedAt: { not: null }, ...dateFilter },
    }),
    prisma.download.groupBy({
      by: ['countryCode'],
      where: { ...trackWhere, countedAt: { not: null }, countryCode: { not: null }, ...dateFilter },
      _count: { countryCode: true },
    }),
    prisma.download.findMany({
      where: { ...trackWhere, countedAt: { not: null }, ...dateFilter },
      select: { createdAt: true },
    }),
  ])

  const countries = countryRows
    .filter((row) => row.countryCode)
    .map((row) => ({
      countryCode: row.countryCode!,
      displayName: countryDisplayName(row.countryCode!),
      count: row._count.countryCode,
    }))
    .sort((a, b) => b.count - a.count)

  const dayKeys = period === 'all' ? utcDaysBack(90) : utcDaysBack(period === '7d' ? 7 : 30)
  const byDay: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]))
  for (const row of dailyRows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    if (key in byDay) byDay[key]++
  }
  const daily = dayKeys.map((date) => ({ date, downloads: byDay[date] ?? 0 }))

  return {
    title,
    period,
    totalDownloads,
    totalPlays: totalDownloads,
    daily,
    countries,
  }
}

export async function buildArchiveItemInsights(
  prisma: PrismaClient,
  userId: string,
  archiveItemId: string,
  period: InsightsPeriod,
) {
  const item = await prisma.archiveItem.findFirst({
    where: { id: archiveItemId, channel: { userId } },
    select: { id: true, title: true },
  })
  if (!item) return null
  return buildInsights(prisma, { archiveItemId: item.id }, period, item.title)
}

export async function buildReleaseTrackInsights(
  prisma: PrismaClient,
  userId: string,
  releaseTrackId: string,
  period: InsightsPeriod,
) {
  const track = await prisma.releaseTrack.findFirst({
    where: { id: releaseTrackId, release: { userId } },
    select: { id: true, title: true },
  })
  if (!track) return null
  return buildInsights(prisma, { releaseTrackId: track.id }, period, track.title)
}
