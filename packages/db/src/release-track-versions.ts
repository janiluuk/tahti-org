// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

/** Copy the active version's audio keys onto the parent track (stable public id). */
export async function syncActiveVersionToTrack(
  prisma: PrismaClient,
  releaseTrackId: string,
): Promise<void> {
  const active = await prisma.releaseTrackVersion.findFirst({
    where: { releaseTrackId, isActive: true, status: 'READY' },
  })
  if (!active) return

  await prisma.releaseTrack.update({
    where: { id: releaseTrackId },
    data: {
      sourceKey: active.sourceKey,
      sourceFormat: active.sourceFormat,
      sourceSampleRate: active.sourceSampleRate,
      sourceBitDepth: active.sourceBitDepth,
      streamKey: active.streamKey,
      flacKey: active.flacKey,
      durationSec: active.durationSec,
      status: 'READY',
    },
  })
}

/** Backfill version 1 for tracks that only have keys on ReleaseTrack. */
export async function ensureInitialReleaseTrackVersion(
  prisma: PrismaClient,
  releaseTrackId: string,
): Promise<void> {
  const existing = await prisma.releaseTrackVersion.findFirst({
    where: { releaseTrackId },
    select: { id: true },
  })
  if (existing) return

  const track = await prisma.releaseTrack.findUnique({ where: { id: releaseTrackId } })
  if (!track || track.status !== 'READY' || !track.sourceKey) return

  await prisma.releaseTrackVersion.create({
    data: {
      releaseTrackId,
      versionNumber: 1,
      versionLabel: 'Original',
      sourceKey: track.sourceKey,
      sourceFormat: track.sourceFormat,
      sourceSampleRate: track.sourceSampleRate,
      sourceBitDepth: track.sourceBitDepth,
      streamKey: track.streamKey,
      flacKey: track.flacKey,
      durationSec: track.durationSec,
      status: 'READY',
      isActive: true,
    },
  })
}
