// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** Sum sound + stash bytes for dashboard display (storage-policy.md — track usage, no hard cap for members). */
export async function computeUserStorageUsedBytes(
  prisma: PrismaClient,
  userId: string,
): Promise<bigint> {
  const [soundAgg, stashAgg] = await Promise.all([
    prisma.sound.aggregate({
      where: { channel: { userId } },
      _sum: { fileSizeBytes: true },
    }),
    prisma.stashFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    }),
  ])

  return (soundAgg._sum.fileSizeBytes ?? 0n) + (stashAgg._sum.sizeBytes ?? 0n)
}

/**
 * Same as computeUserStorageUsedBytes, but for every user with sound or
 * stash content, in 3 queries total instead of 2-per-user — the admin
 * storage overview needs every user's usage at once, and looping
 * computeUserStorageUsedBytes per user would be an N+1 query pattern (fine
 * for one user's own /api/me/storage, not for a platform-wide dashboard).
 *
 * Sound has no direct userId column (it hangs off Channel, which is
 * 1:1 with User), so sound bytes are grouped by channelId first and then
 * remapped to userId via a channelId->userId lookup; stash bytes already
 * have a direct userId column and group straight from that.
 */
export async function computeAllUsersStorageUsedBytes(
  prisma: PrismaClient,
): Promise<Map<string, bigint>> {
  const [soundByChannel, stashByUser, channels] = await Promise.all([
    prisma.sound.groupBy({
      by: ['channelId'],
      _sum: { fileSizeBytes: true },
    }),
    prisma.stashFile.groupBy({
      by: ['userId'],
      _sum: { sizeBytes: true },
    }),
    prisma.channel.findMany({ select: { id: true, userId: true } }),
  ])

  const channelToUser = new Map(channels.map((c) => [c.id, c.userId]))
  const totals = new Map<string, bigint>()

  for (const row of soundByChannel) {
    const userId = channelToUser.get(row.channelId)
    if (!userId) continue
    const bytes = row._sum.fileSizeBytes ?? 0n
    totals.set(userId, (totals.get(userId) ?? 0n) + bytes)
  }
  for (const row of stashByUser) {
    const bytes = row._sum.sizeBytes ?? 0n
    totals.set(row.userId, (totals.get(row.userId) ?? 0n) + bytes)
  }

  return totals
}
