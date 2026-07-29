// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'

export const DEFAULT_QUOTA_BYTES = BigInt(500 * 1024 * 1024)

/** Positive delta on R2 write, negative on R2 delete. Lazily creates the quota row. */
export async function recordUsageDelta(userId: string, deltaBytes: number): Promise<void> {
  await prisma.userStorageQuota.upsert({
    where: { userId },
    create: { userId, quotaBytes: DEFAULT_QUOTA_BYTES, usedBytes: Math.max(0, deltaBytes) },
    update: { usedBytes: { increment: deltaBytes } },
  })
}
