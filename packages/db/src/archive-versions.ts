// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

/** Copy the active version's audio keys onto the parent item (stable public URL). */
export async function syncActiveVersionToItem(
  prisma: PrismaClient,
  archiveItemId: string,
): Promise<void> {
  const active = await prisma.archiveItemVersion.findFirst({
    where: { archiveItemId, isActive: true, status: 'READY' },
  })
  if (!active) return

  await prisma.archiveItem.update({
    where: { id: archiveItemId },
    data: {
      rawKey: active.rawKey,
      mp3Key: active.mp3Key,
      flacKey: active.flacKey,
      durationSec: active.durationSec,
      peaks: active.peaks ?? undefined,
      fileSizeBytes: active.fileSizeBytes,
      status: 'READY',
    },
  })
}

/** Backfill version 1 for legacy items that only have keys on ArchiveItem. */
export async function ensureInitialVersion(
  prisma: PrismaClient,
  archiveItemId: string,
): Promise<void> {
  const existing = await prisma.archiveItemVersion.findFirst({
    where: { archiveItemId },
    select: { id: true },
  })
  if (existing) return

  const item = await prisma.archiveItem.findUnique({ where: { id: archiveItemId } })
  if (!item || item.status !== 'READY') return

  await prisma.archiveItemVersion.create({
    data: {
      archiveItemId,
      versionNumber: 1,
      versionLabel: item.mixVersion?.trim() || 'Original',
      rawKey: item.rawKey,
      mp3Key: item.mp3Key,
      flacKey: item.flacKey,
      durationSec: item.durationSec,
      fileSizeBytes: item.fileSizeBytes,
      status: 'READY',
      isActive: true,
    },
  })
}
