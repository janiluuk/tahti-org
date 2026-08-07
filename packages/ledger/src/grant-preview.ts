// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { allocateGrants } from './allocate.js'
import { computeEngagementUnits } from './run.js'

export type GrantAnomalyCode = 'DOMINANT_IP' | 'HIGH_UNIT_SHARE' | 'ANONYMOUS_GRANT'

export interface GrantAnomaly {
  code: GrantAnomalyCode
  message: string
}

export interface GrantPreviewArtist {
  userId: string
  username: string
  displayName: string
  publicAttribution: boolean
  units: number
  amountCents: number
  freeDownloads: number
  paidDownloads: number
  fanSubEuros: number
  anomalies: GrantAnomaly[]
}

export interface GrantPreviewResult {
  forYear: number
  alreadyRun: boolean
  surplusCents: number
  reserveCents: number
  poolCents: number
  totalUnits: number
  grantCount: number
  unallocatedCents: number
  artists: GrantPreviewArtist[]
}

const DOMINANT_IP_MIN_COUNTED = 15
const DOMINANT_IP_PCT = 0.4
const HIGH_UNIT_SHARE_PCT = 0.35

/** DIRECTOR-001: dry-run grant split with per-artist fraud/anomaly flags for board review. */
export async function buildGrantPreview(
  prisma: PrismaClient,
  year: number,
): Promise<GrantPreviewResult> {
  const existing = await prisma.grantDisbursement.count({ where: { forYear: year } })
  const rollups = await prisma.monthlyRollup.findMany({
    where: { yearMonth: { startsWith: `${year}-` } },
    select: { surplus: true },
  })
  const surplusCents = rollups.reduce((s, r) => s + Number(r.surplus), 0)

  const unitRows = await computeEngagementUnits(prisma, year)
  const allocation = allocateGrants({ surplusCents, artists: unitRows })
  const amountByUser = new Map(allocation.allocations.map((a) => [a.userId, a.amountCents]))

  const users = unitRows.length
    ? await prisma.user.findMany({
        where: { id: { in: unitRows.map((u) => u.userId) } },
        select: {
          id: true,
          username: true,
          displayName: true,
          publicAttribution: true,
          channel: { select: { id: true } },
        },
      })
    : []

  const userById = new Map(users.map((u) => [u.id, u]))
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  // Batch the DOMINANT_IP anomaly check across every artist's channel in one
  // query instead of one `download.findMany` per artist — this runs on every
  // board view of the grant preview, not just the annual disbursement run.
  const channelIds = users.map((u) => u.channel?.id).filter((id): id is string => Boolean(id))
  const ipCounts = channelIds.length
    ? await prisma.download.groupBy({
        by: ['channelId', 'byIpHash'],
        where: { channelId: { in: channelIds }, countedAt: { gte: start, lt: end } },
        _count: { _all: true },
      })
    : []
  const downloadStatsByChannel = new Map<string, { total: number; topIpCount: number }>()
  for (const row of ipCounts) {
    const count = row._count._all
    const stats = downloadStatsByChannel.get(row.channelId) ?? { total: 0, topIpCount: 0 }
    stats.total += count
    if (count > stats.topIpCount) stats.topIpCount = count
    downloadStatsByChannel.set(row.channelId, stats)
  }

  const artists: GrantPreviewArtist[] = []

  for (const row of unitRows) {
    const user = userById.get(row.userId)
    const anomalies: GrantAnomaly[] = []

    if (user && !user.publicAttribution) {
      anomalies.push({
        code: 'ANONYMOUS_GRANT',
        message: 'Artist opted out of public attribution on the grant report',
      })
    }

    if (allocation.totalUnits > 0 && row.units / allocation.totalUnits >= HIGH_UNIT_SHARE_PCT) {
      anomalies.push({
        code: 'HIGH_UNIT_SHARE',
        message: `Engagement units are ${Math.round((row.units / allocation.totalUnits) * 100)}% of the pool — review for inflation`,
      })
    }

    const channelId = user?.channel?.id
    const stats = channelId ? downloadStatsByChannel.get(channelId) : undefined
    if (stats && stats.total >= DOMINANT_IP_MIN_COUNTED) {
      const pct = stats.topIpCount / stats.total
      if (pct >= DOMINANT_IP_PCT) {
        anomalies.push({
          code: 'DOMINANT_IP',
          message: `One IP hash accounts for ${Math.round(pct * 100)}% of counted downloads (${stats.topIpCount}/${stats.total})`,
        })
      }
    }

    artists.push({
      userId: row.userId,
      username: user?.username ?? 'unknown',
      displayName: user?.displayName ?? 'Unknown',
      publicAttribution: user?.publicAttribution ?? true,
      units: row.units,
      amountCents: amountByUser.get(row.userId) ?? 0,
      freeDownloads: row.freeDownloads,
      paidDownloads: row.paidDownloads,
      fanSubEuros: row.fanSubEuros,
      anomalies,
    })
  }

  artists.sort((a, b) => b.units - a.units)

  return {
    forYear: year,
    alreadyRun: existing > 0,
    surplusCents: allocation.surplusCents,
    reserveCents: allocation.reserveCents,
    poolCents: allocation.poolCents,
    totalUnits: allocation.totalUnits,
    grantCount: allocation.allocations.length,
    unallocatedCents: allocation.unallocatedCents,
    artists,
  }
}
