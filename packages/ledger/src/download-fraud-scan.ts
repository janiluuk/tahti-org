// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const DOWNLOAD_FRAUD_GROWTH_FACTOR = 20
export const DOWNLOAD_FRAUD_MIN_COUNTED = 10

/** True when yesterday's counted downloads exceed the fraud threshold vs the prior day. */
export function downloadGrowthExceedsThreshold(
  yesterday: number,
  dayBefore: number,
  growthFactor = DOWNLOAD_FRAUD_GROWTH_FACTOR,
  minCounted = DOWNLOAD_FRAUD_MIN_COUNTED,
): boolean {
  const baseline = Math.max(dayBefore, 1)
  if (yesterday < minCounted) return false
  return yesterday / baseline >= growthFactor
}

/** M18: flag channels with suspicious day-over-day download growth for board review. */
export async function processDownloadFraudScan(prisma: PrismaClient) {
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)
  const dayBeforeStart = new Date(todayStart.getTime() - 48 * 60 * 60 * 1000)

  const channels = await prisma.channel.findMany({ select: { id: true, userId: true, slug: true } })

  let flagged = 0

  for (const channel of channels) {
    const [yesterday, dayBefore] = await Promise.all([
      prisma.download.count({
        where: {
          channelId: channel.id,
          countedAt: { gte: yesterdayStart, lt: todayStart },
        },
      }),
      prisma.download.count({
        where: {
          channelId: channel.id,
          countedAt: { gte: dayBeforeStart, lt: yesterdayStart },
        },
      }),
    ])

    if (!downloadGrowthExceedsThreshold(yesterday, dayBefore)) continue

    const recentAlert = await prisma.auditLog.findFirst({
      where: {
        action: 'DOWNLOAD_FRAUD_ALERT',
        targetId: channel.id,
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    })
    if (recentAlert) continue

    const baseline = Math.max(dayBefore, 1)
    await prisma.auditLog.create({
      data: {
        action: 'DOWNLOAD_FRAUD_ALERT',
        actorId: 'system',
        targetId: channel.id,
        meta: {
          channelSlug: channel.slug,
          artistUserId: channel.userId,
          yesterday,
          dayBefore,
          growthFactor: Math.round((yesterday / baseline) * 10) / 10,
        },
      },
    })
    flagged++
  }

  return { flagged, channelsScanned: channels.length }
}
