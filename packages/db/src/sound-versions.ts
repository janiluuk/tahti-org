// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

/** Copy the active version's audio keys onto the parent item (stable public URL). */
export async function syncActiveVersionToItem(
  prisma: PrismaClient,
  soundId: string,
): Promise<void> {
  const active = await prisma.soundVersion.findFirst({
    where: { soundId, isActive: true, status: 'READY' },
  })
  if (!active) return

  await prisma.sound.update({
    where: { id: soundId },
    data: {
      rawKey: active.rawKey,
      mp3Key: active.mp3Key,
      flacKey: active.flacKey,
      durationSec: active.durationSec,
      sourceFormat: active.sourceFormat,
      sourceBitrateKbps: active.sourceBitrateKbps,
      sourceSampleRateHz: active.sourceSampleRateHz,
      sourceBitDepth: active.sourceBitDepth,
      sourceChannels: active.sourceChannels,
      peaks: active.peaks ?? undefined,
      fileSizeBytes: active.fileSizeBytes,
      status: 'READY',
    },
  })
}

/** Backfill version 1 for legacy items that only have keys on Sound. */
export async function ensureInitialVersion(prisma: PrismaClient, soundId: string): Promise<void> {
  const existing = await prisma.soundVersion.findFirst({
    where: { soundId },
    select: { id: true },
  })
  if (existing) return

  const item = await prisma.sound.findUnique({ where: { id: soundId } })
  if (!item || item.status !== 'READY' || !item.rawKey || item.fileSizeBytes == null) return

  await prisma.soundVersion.create({
    data: {
      soundId,
      versionNumber: 1,
      versionLabel: item.mixVersion?.trim() || 'Original',
      rawKey: item.rawKey,
      mp3Key: item.mp3Key,
      flacKey: item.flacKey,
      durationSec: item.durationSec,
      sourceFormat: item.sourceFormat,
      sourceBitrateKbps: item.sourceBitrateKbps,
      sourceSampleRateHz: item.sourceSampleRateHz,
      sourceBitDepth: item.sourceBitDepth,
      sourceChannels: item.sourceChannels,
      fileSizeBytes: item.fileSizeBytes,
      status: 'READY',
      isActive: true,
    },
  })
}
