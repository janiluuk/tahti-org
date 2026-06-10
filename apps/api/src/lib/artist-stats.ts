// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import type { StatsRangeQuery } from '@tahti/shared'
import { countryDisplayName } from './geoip.js'

const CC_TLD: Record<string, string> = {
  FI: 'Finland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  DE: 'Germany',
  FR: 'France',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  US: 'United States',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  PL: 'Poland',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  JP: 'Japan',
  AU: 'Australia',
  CA: 'Canada',
  BR: 'Brazil',
}

function utcDayKeys(days: number): { since: Date; keys: string[] } {
  const keys: string[] = []
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  )
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    keys.push(d.toISOString().slice(0, 10))
  }
  return { since: start, keys }
}

function bucketByUtcDay(rows: { createdAt: Date }[], keys: string[]): Record<string, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    if (key in counts) counts[key]++
  }
  return counts
}

function rangeDays(range: StatsRangeQuery): number | null {
  if (range === '7') return 7
  if (range === '30') return 30
  return null
}

function countryFromReferer(referer: string | null): string {
  if (!referer?.trim()) return 'Direct'
  try {
    const host = new URL(referer).hostname.toLowerCase()
    const parts = host.split('.')
    const tld = parts.at(-1)?.toUpperCase() ?? ''
    if (tld.length === 2 && CC_TLD[tld]) return CC_TLD[tld]
    if (parts.length >= 2) return parts.slice(-2).join('.')
    return host
  } catch {
    return 'Unknown'
  }
}

export async function buildArtistPlaysStats(
  prisma: PrismaClient,
  userId: string,
  range: StatsRangeQuery,
) {
  const days = rangeDays(range)
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true },
  })

  const releaseIds = (
    await prisma.release.findMany({
      where: { userId },
      select: { id: true },
    })
  ).map((r) => r.id)

  const since =
    days != null
      ? utcDayKeys(days).since
      : new Date(Date.UTC(new Date().getUTCFullYear() - 2, 0, 1))

  const keys = days != null ? utcDayKeys(days).keys : null

  const [downloadRows, clickRows, downloadCountryRows] = await Promise.all([
    channel
      ? prisma.download.findMany({
          where: { channelId: channel.id, countedAt: { not: null }, createdAt: { gte: since } },
          select: { createdAt: true },
        })
      : [],
    releaseIds.length > 0
      ? prisma.smartLinkClick.findMany({
          where: { releaseId: { in: releaseIds }, createdAt: { gte: since } },
          select: { createdAt: true },
        })
      : [],
    channel
      ? prisma.download.groupBy({
          by: ['countryCode'],
          where: {
            channelId: channel.id,
            countedAt: { not: null },
            createdAt: { gte: since },
            countryCode: { not: null },
          },
          _count: { countryCode: true },
        })
      : [],
  ])

  let daily: Array<{
    date: string
    downloads: number
    smartLinkClicks: number
    plays: number
  }>

  if (keys) {
    const downloads = bucketByUtcDay(downloadRows, keys)
    const clicks = bucketByUtcDay(clickRows, keys)
    daily = keys.map((date) => {
      const d = downloads[date] ?? 0
      const c = clicks[date] ?? 0
      return { date, downloads: d, smartLinkClicks: c, plays: d + c }
    })
  } else {
    const allKeys = [
      ...new Set([
        ...downloadRows.map((r) => r.createdAt.toISOString().slice(0, 10)),
        ...clickRows.map((r) => r.createdAt.toISOString().slice(0, 10)),
      ]),
    ].sort()
    const downloads = bucketByUtcDay(downloadRows, allKeys)
    const clicks = bucketByUtcDay(clickRows, allKeys)
    daily = allKeys.map((date) => {
      const d = downloads[date] ?? 0
      const c = clicks[date] ?? 0
      return { date, downloads: d, smartLinkClicks: c, plays: d + c }
    })
  }

  const totalDownloads = downloadRows.length
  const totalSmartLinkClicks = clickRows.length

  const downloadCountries = downloadCountryRows
    .filter((row) => row.countryCode)
    .map((row) => ({
      countryCode: row.countryCode!,
      displayName: countryDisplayName(row.countryCode!),
      count: row._count.countryCode,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    range,
    ...(days != null ? { windowDays: days } : {}),
    totalPlays: totalDownloads + totalSmartLinkClicks,
    totalDownloads,
    totalSmartLinkClicks,
    daily,
    downloadCountries,
  }
}

export async function buildTopTracksStats(prisma: PrismaClient, userId: string, limit = 10) {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!channel)
    return { items: [] as Array<{ archiveItemId: string; title: string; plays: number }> }

  const items = await prisma.archiveItem.findMany({
    where: { channelId: channel.id, status: 'READY' },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const itemIds = items.map((i) => i.id)
  if (itemIds.length === 0) return { items: [] }

  const counts = await prisma.download.groupBy({
    by: ['archiveItemId'],
    where: { archiveItemId: { in: itemIds }, countedAt: { not: null } },
    _count: { _all: true },
  })

  const countById = new Map(
    counts.filter((c) => c.archiveItemId != null).map((c) => [c.archiveItemId!, c._count._all]),
  )

  const ranked = items
    .map((item) => ({
      archiveItemId: item.id,
      title: item.title,
      plays: countById.get(item.id) ?? 0,
    }))
    .filter((i) => i.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit)

  return { items: ranked }
}

export async function buildTopCountriesStats(prisma: PrismaClient, userId: string, limit = 10) {
  const releaseIds = (
    await prisma.release.findMany({
      where: { userId },
      select: { id: true },
    })
  ).map((r) => r.id)

  if (releaseIds.length === 0) return { items: [] as Array<{ country: string; count: number }> }

  const clicks = await prisma.smartLinkClick.findMany({
    where: { releaseId: { in: releaseIds } },
    select: { referer: true },
  })

  const byCountry = new Map<string, number>()
  for (const click of clicks) {
    const country = countryFromReferer(click.referer)
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
  }

  const items = [...byCountry.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  return { items }
}
