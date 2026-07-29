// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { stat } from 'node:fs/promises'
import { prisma } from '@tahti/db'
import { deleteFromR2, r2Enabled, uploadFileToR2 } from './r2.js'
import { recordUsageDelta } from './storage-quota.js'

// Only the most recent 4 versions per track (current + 3 previous) keep a
// live R2 copy — enough to roll back a bad re-upload without keeping every
// draft forever. See [[hosting-decisions]] "R2 long-term, only final
// material" + the explicit "keep 3 previous ones" retention request.
const KEEP_R2_VERSIONS = 4

/** Uploads the original (lossless) source file through to R2 and records quota usage.
 * No-op (returns null) when R2 isn't configured — callers just skip the DB fields. */
export async function writeThroughToR2(
  srcPath: string,
  r2Key: string,
  contentType: string,
  userId: string,
): Promise<{ r2Key: string; sizeBytes: number } | null> {
  if (!r2Enabled) return null
  const fileStat = await stat(srcPath)
  await uploadFileToR2(r2Key, srcPath, contentType)
  await recordUsageDelta(userId, fileStat.size)
  return { r2Key, sizeBytes: fileStat.size }
}

/** Purges R2 copies of a track's versions beyond the retention window, oldest first. */
export async function pruneOldR2VersionsForTrack(
  releaseTrackId: string,
  userId: string,
): Promise<void> {
  const versions = await prisma.releaseTrackVersion.findMany({
    where: { releaseTrackId, r2Key: { not: null } },
    orderBy: { versionNumber: 'desc' },
    select: { id: true, r2Key: true, r2SizeBytes: true },
  })

  for (const version of versions.slice(KEEP_R2_VERSIONS)) {
    if (!version.r2Key) continue
    await deleteFromR2(version.r2Key)
    if (version.r2SizeBytes) await recordUsageDelta(userId, -version.r2SizeBytes)
    await prisma.releaseTrackVersion.update({
      where: { id: version.id },
      data: { r2Key: null, r2SizeBytes: null },
    })
  }
}
