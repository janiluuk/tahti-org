// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** Sum archive + stash bytes for dashboard display (storage-policy.md — track usage, no hard cap for members). */
export async function computeUserStorageUsedBytes(
  prisma: PrismaClient,
  userId: string,
): Promise<bigint> {
  const [archiveAgg, stashAgg] = await Promise.all([
    prisma.archiveItem.aggregate({
      where: { channel: { userId } },
      _sum: { fileSizeBytes: true },
    }),
    prisma.stashFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    }),
  ])

  return (archiveAgg._sum.fileSizeBytes ?? 0n) + (stashAgg._sum.sizeBytes ?? 0n)
}
