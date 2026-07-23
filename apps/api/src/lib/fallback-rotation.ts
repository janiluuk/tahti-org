// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { MAX_FALLBACK_ITEMS } from '@tahti/shared'

export { MAX_FALLBACK_ITEMS }

export async function fallbackCount(prisma: PrismaClient, channelId: string): Promise<number> {
  return prisma.archiveItem.count({ where: { channelId, isFallback: true } })
}

/** The item that would be evicted to make room for one more — oldest by
 * fallbackOrder (manual mode), falling back to oldest by createdAt. */
export async function oldestFallbackItem(
  prisma: PrismaClient,
  channelId: string,
  excludeId?: string,
): Promise<{ id: string; title: string } | null> {
  return prisma.archiveItem.findFirst({
    where: { channelId, isFallback: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ fallbackOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, title: true },
  })
}
