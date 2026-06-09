// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-064: aggregate listener geography from Download table (countryCode) +
// Redis HLS geo hashes (hIncrBy country totals from Caddy logs).

import type { PrismaClient } from '@tahti/db'
import { hlsListenerGeoRedisKey } from '@tahti/shared'
import { getRedisClient } from './redis.js'

export type ListenerGeoPoint = {
  countryCode: string
  count: number
}

function utcDaysBack(n: number): string[] {
  const days: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

async function fetchHlsGeoCounts(
  slug: string,
  dates: string[],
): Promise<Record<string, number>> {
  const client = await getRedisClient()
  if (!client) return {}

  const totals: Record<string, number> = {}
  await Promise.all(
    dates.map(async (date) => {
      const raw = await client.hGetAll(hlsListenerGeoRedisKey(slug, date))
      for (const [cc, val] of Object.entries(raw)) {
        totals[cc] = (totals[cc] ?? 0) + (parseInt(val, 10) || 0)
      }
    }),
  )
  return totals
}

export async function buildListenerGeo(
  prisma: PrismaClient,
  userId: string,
  period: '7d' | '30d' | 'all',
): Promise<ListenerGeoPoint[]> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true, slug: true },
  })
  if (!channel) return []

  // Download-table geo (archive + release)
  const sinceDate = period === 'all' ? undefined : new Date(
    Date.now() - (period === '7d' ? 7 : 30) * 86_400_000,
  )

  const rows = await prisma.download.groupBy({
    by: ['countryCode'],
    where: {
      channelId: channel.id,
      countryCode: { not: null },
      ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
    },
    _count: { countryCode: true },
  })

  const totals: Record<string, number> = {}
  for (const row of rows) {
    if (row.countryCode) {
      totals[row.countryCode] = (totals[row.countryCode] ?? 0) + row._count.countryCode
    }
  }

  // HLS listener geo from Redis
  const dates = period === 'all' ? utcDaysBack(90) : utcDaysBack(period === '7d' ? 7 : 30)
  const hlsCounts = await fetchHlsGeoCounts(channel.slug, dates)
  for (const [cc, n] of Object.entries(hlsCounts)) {
    totals[cc] = (totals[cc] ?? 0) + n
  }

  return Object.entries(totals)
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count)
}
