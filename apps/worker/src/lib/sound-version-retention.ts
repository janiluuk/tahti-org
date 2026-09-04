// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { deleteObject } from './minio.js'

export const SOUND_REVISION_RETENTION = 10

/** Keep the immutable original (v1) plus the ten newest rendered/uploaded revisions. */
export async function pruneSoundRevisions(prisma: PrismaClient, soundId: string): Promise<void> {
  const revisions = await prisma.soundVersion.findMany({
    where: { soundId, versionNumber: { gt: 1 }, status: 'READY' },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, rawKey: true, mp3Key: true, flacKey: true, isActive: true },
  })

  for (const revision of revisions.slice(SOUND_REVISION_RETENTION)) {
    if (revision.isActive) continue
    const keys = new Set([revision.rawKey, revision.mp3Key, revision.flacKey].filter(Boolean))
    for (const key of keys) await deleteObject(key!).catch(() => undefined)
    await prisma.soundVersion.delete({ where: { id: revision.id } })
  }
}
