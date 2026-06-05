// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { ensureInitialVersion } from '@tahti/db'

export async function resolveArchiveEditorSource(
  prisma: PrismaClient,
  archiveItemId: string,
): Promise<{ sourceKey: string; durationSec: number | null; title: string } | null> {
  const item = await prisma.archiveItem.findUnique({
    where: { id: archiveItemId },
    select: {
      title: true,
      durationSec: true,
      rawKey: true,
      mp3Key: true,
      flacKey: true,
      status: true,
    },
  })
  if (!item || item.status !== 'READY') return null

  await ensureInitialVersion(prisma, archiveItemId)

  const active = await prisma.archiveItemVersion.findFirst({
    where: { archiveItemId, isActive: true, status: 'READY' },
    select: { rawKey: true, flacKey: true, mp3Key: true, durationSec: true },
  })

  const sourceKey =
    active?.rawKey ??
    active?.flacKey ??
    active?.mp3Key ??
    item.rawKey ??
    item.flacKey ??
    item.mp3Key ??
    null

  if (!sourceKey) return null

  return {
    sourceKey,
    durationSec: active?.durationSec ?? item.durationSec,
    title: item.title,
  }
}
