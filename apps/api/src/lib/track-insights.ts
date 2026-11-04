// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M37: per-track "Show insights" — country breakdown + daily downloads for a
// single Sound or ReleaseTrack, time-filterable. "Plays" mirrors the
// platform-wide convention elsewhere (artist-stats.ts): there is no separate
// play-event log, so plays === counted downloads at track granularity (no
// per-track smart-link click data exists to add on top, unlike the
// channel-wide stat). Listening-pattern charts (hour / weekday / calendar)
// count unique ListenSession fingerprints so colour intensity is listeners,
// not duration.

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

function emptyPatterns(dayKeys: string[]) {
  return {
    hourlyUsers: Array.from({ length: 24 }, () => 0),
    dayOfWeekUsers: [0, 0, 0, 0, 0, 0, 0] as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ],
    dailyUsers: dayKeys.map((date) => ({ date, users: 0 })),
  }
}

/** Unique listener fingerprints per hour / weekday / day for one sound. */
async function listeningPatterns(
  prisma: PrismaClient,
  soundId: string | null,
  period: InsightsPeriod,
  dayKeys: string[],
  excludeUserId: string,
) {
  if (!soundId) return emptyPatterns(dayKeys)

  const since = sinceDateFor(period)
  const sessions = await prisma.listenSession.findMany({
    where: {
      soundId,
      isBot: false,
      ...(since ? { startedAt: { gte: since } } : {}),
      OR: [{ byUserId: null }, { byUserId: { not: excludeUserId } }],
    },
    select: { startedAt: true, byFingerprint: true },
  })

  const hourSets = Array.from({ length: 24 }, () => new Set<string>())
  const weekdaySets = Array.from({ length: 7 }, () => new Set<string>())
  const daySets = new Map<string, Set<string>>(dayKeys.map((k) => [k, new Set()]))

  for (const row of sessions) {
    const at = row.startedAt
    const fingerprint = row.byFingerprint
    hourSets[at.getUTCHours()]!.add(fingerprint)
    const mondayFirst = (at.getUTCDay() + 6) % 7
    weekdaySets[mondayFirst]!.add(fingerprint)
    const dayKey = at.toISOString().slice(0, 10)
    daySets.get(dayKey)?.add(fingerprint)
  }

  return {
    hourlyUsers: hourSets.map((set) => set.size),
    dayOfWeekUsers: weekdaySets.map((set) => set.size) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ],
    dailyUsers: dayKeys.map((date) => ({
      date,
      users: daySets.get(date)?.size ?? 0,
    })),
  }
}

async function buildInsights(
  prisma: PrismaClient,
  trackWhere: { soundId: string } | { releaseTrackId: string },
  period: InsightsPeriod,
  title: string,
  ownerUserId: string,
  listenSoundId: string | null,
) {
  const since = sinceDateFor(period)
  const dateFilter = since ? { createdAt: { gte: since } } : {}

  const dayKeys = period === 'all' ? utcDaysBack(90) : utcDaysBack(period === '7d' ? 7 : 30)

  const [totalDownloads, countryRows, dailyRows, patterns] = await Promise.all([
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
    listeningPatterns(prisma, listenSoundId, period, dayKeys, ownerUserId),
  ])

  const countries = countryRows
    .filter((row) => row.countryCode)
    .map((row) => ({
      countryCode: row.countryCode!,
      displayName: countryDisplayName(row.countryCode!),
      count: row._count.countryCode,
    }))
    .sort((a, b) => b.count - a.count)

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
    ...patterns,
  }
}

export async function buildSoundInsights(
  prisma: PrismaClient,
  userId: string,
  soundId: string,
  period: InsightsPeriod,
) {
  const item = await prisma.sound.findFirst({
    where: { id: soundId, channel: { userId } },
    select: { id: true, title: true },
  })
  if (!item) return null
  return buildInsights(prisma, { soundId: item.id }, period, item.title, userId, item.id)
}

export async function buildReleaseTrackInsights(
  prisma: PrismaClient,
  userId: string,
  releaseTrackId: string,
  period: InsightsPeriod,
) {
  const track = await prisma.releaseTrack.findFirst({
    where: { id: releaseTrackId, release: { userId } },
    select: { id: true, title: true, soundId: true },
  })
  if (!track) return null
  return buildInsights(
    prisma,
    { releaseTrackId: track.id },
    period,
    track.title,
    userId,
    track.soundId ?? null,
  )
}
