// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const MS_PER_HOUR = 60 * 60 * 1000

/**
 * Public live time of a session in hours. Preview-only sessions and 24/7 fallback
 * placeholders never get `wentLiveAt`, so they count as zero.
 */
export function broadcastLiveHours(wentLiveAt: Date | null, endedAt: Date): number {
  if (!wentLiveAt) return 0
  return Math.max(0, endedAt.getTime() - wentLiveAt.getTime()) / MS_PER_HOUR
}

/**
 * Ends one broadcast and adds its live time to `Channel.totalLiveHours`.
 * Returns false when the broadcast was already ended, in which case nothing is counted.
 */
export async function endBroadcast(
  prisma: PrismaClient,
  broadcastId: string,
  endedAt: Date = new Date(),
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // The `endedAt: null` guard makes the close and the increment happen at most once,
    // even when two end paths race for the same session.
    const closed = await tx.broadcast.updateMany({
      where: { id: broadcastId, endedAt: null },
      data: { endedAt },
    })
    if (closed.count === 0) return false

    const broadcast = await tx.broadcast.findUniqueOrThrow({
      where: { id: broadcastId },
      select: { channelId: true, wentLiveAt: true },
    })
    const hours = broadcastLiveHours(broadcast.wentLiveAt, endedAt)
    if (hours > 0) {
      await tx.channel.update({
        where: { id: broadcast.channelId },
        data: { totalLiveHours: { increment: hours } },
      })
    }
    return true
  })
}

export async function endOpenBroadcasts(
  prisma: PrismaClient,
  channelId: string,
  endedAt: Date = new Date(),
): Promise<void> {
  const open = await prisma.broadcast.findMany({
    where: { channelId, endedAt: null },
    select: { id: true },
  })
  for (const { id } of open) {
    await endBroadcast(prisma, id, endedAt)
  }
}
