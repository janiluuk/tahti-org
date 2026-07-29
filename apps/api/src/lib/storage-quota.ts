// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const DEFAULT_QUOTA_BYTES = BigInt(500 * 1024 * 1024)

export async function getOrCreateQuota(
  prisma: PrismaClient,
  userId: string,
): Promise<{ quotaBytes: bigint; usedBytes: bigint }> {
  const quota = await prisma.userStorageQuota.upsert({
    where: { userId },
    create: { userId, quotaBytes: DEFAULT_QUOTA_BYTES },
    update: {},
    select: { quotaBytes: true, usedBytes: true },
  })
  return quota
}

export async function hasRoomFor(
  prisma: PrismaClient,
  userId: string,
  additionalBytes: number,
): Promise<boolean> {
  const { quotaBytes, usedBytes } = await getOrCreateQuota(prisma, userId)
  return usedBytes + BigInt(additionalBytes) <= quotaBytes
}

/** Positive delta on upload, negative on delete. Lazily creates the quota row. */
export async function recordUsageDelta(
  prisma: PrismaClient,
  userId: string,
  deltaBytes: number,
): Promise<void> {
  await getOrCreateQuota(prisma, userId)
  await prisma.userStorageQuota.update({
    where: { userId },
    data: { usedBytes: { increment: deltaBytes } },
  })
}
