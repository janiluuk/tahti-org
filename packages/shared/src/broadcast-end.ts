// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { BROADCAST_RECONNECT_GRACE_MS } from './broadcast-session.js'

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
  guard: { ingestDisconnectedBefore?: Date } = {},
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // The `endedAt: null` guard makes the close and the increment happen at most once,
    // even when two end paths race for the same session. The optional ingest guard
    // keeps a session the encoder has just reconnected to from being closed.
    const closed = await tx.broadcast.updateMany({
      where: {
        id: broadcastId,
        endedAt: null,
        ...(guard.ingestDisconnectedBefore
          ? { ingestDisconnectedAt: { lte: guard.ingestDisconnectedBefore } }
          : {}),
      },
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

/**
 * Ends sessions whose encoder dropped while LIVE and didn't reconnect within
 * BROADCAST_RECONNECT_GRACE_MS, and takes their channels OFFLINE. Returns the
 * ended sessions so the caller can queue their recordings.
 */
export async function endExpiredReconnectingBroadcasts(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<Array<{ broadcastId: string; channelId: string; autoRecordEnabled: boolean }>> {
  const cutoff = new Date(now.getTime() - BROADCAST_RECONNECT_GRACE_MS)
  const expired = await prisma.broadcast.findMany({
    where: { endedAt: null, ingestDisconnectedAt: { lte: cutoff } },
    select: {
      id: true,
      channelId: true,
      ingestDisconnectedAt: true,
      channel: { select: { autoRecordEnabled: true } },
    },
  })
  const ended: Array<{ broadcastId: string; channelId: string; autoRecordEnabled: boolean }> = []
  for (const broadcast of expired) {
    // The show ended when the encoder dropped; the grace period isn't live time.
    const endedAt = broadcast.ingestDisconnectedAt!
    if (
      !(await endBroadcast(prisma, broadcast.id, endedAt, { ingestDisconnectedBefore: cutoff }))
    ) {
      continue
    }
    await prisma.channel.update({
      where: { id: broadcast.channelId },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
    ended.push({
      broadcastId: broadcast.id,
      channelId: broadcast.channelId,
      autoRecordEnabled: broadcast.channel.autoRecordEnabled,
    })
  }
  return ended
}
