// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { soundPlaybackKey } from '@tahti/shared'
import { presignedGetUrl } from './minio.js'

// Everything that counts against a user's storage usage (see
// computeUserStorageUsedBytes) lives in one of two tables: Sound (public
// broadcast/track sound — always audio) or StashFile (private uploads —
// arbitrary content, e.g. a WAV master, a ZIP of stems, a cover image).
const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'aiff', 'aif'])

/** Whether a stash file is a playable audio file — gates the Files admin panel's
 * play button so a ZIP or image upload never gets a fake one. Sound items don't
 * need this check: every SoundContentType is audio, so soundPlaybackKey()
 * returning a key is the only gate they need. */
export function isAudioStashFile(file: { contentType: string; format: string | null }): boolean {
  if (file.contentType.toLowerCase().startsWith('audio/')) return true
  if (file.format && AUDIO_EXTENSIONS.has(file.format.toLowerCase())) return true
  return false
}

/** Cumulative sizeBytes total, in the order the caller passes files in. Callers
 * order oldest-first so the sequence reads as "usage accumulating over time" —
 * the last entry always equals the sum of every entry. Null sizes count as 0
 * (never observed in practice, but *_EMBED sound items have no file at all). */
export function computeRunningTotals(sizesBytes: Array<number | null>): number[] {
  let total = 0
  return sizesBytes.map((size) => {
    total += size ?? 0
    return total
  })
}

export interface UserFileRow {
  id: string
  kind: 'sound' | 'stash'
  title: string
  sizeBytes: number | null
  createdAt: Date
  contentType: string | null
  isPublic: boolean | null
  isAudio: boolean
  previewUrl: string | null
}

/** One user's full file list — sound items and stash files merged, oldest
 * first, each carrying a running total of bytes used up to that point. This is
 * the admin Files panel's per-user detail view; the presigned preview URLs are
 * only generated for playable (audio) rows. */
export async function listUserFilesWithRunningTotal(
  prisma: PrismaClient,
  userId: string,
): Promise<Array<UserFileRow & { runningTotalBytes: number }>> {
  const [sounds, stashFiles] = await Promise.all([
    prisma.sound.findMany({
      where: { channel: { userId } },
      select: {
        id: true,
        title: true,
        fileSizeBytes: true,
        createdAt: true,
        contentType: true,
        isPublic: true,
        mp3Key: true,
        flacKey: true,
      },
    }),
    prisma.stashFile.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        createdAt: true,
        contentType: true,
        format: true,
        objectKey: true,
      },
    }),
  ])

  const soundRows: UserFileRow[] = await Promise.all(
    sounds.map(async (item) => {
      const key = soundPlaybackKey(item)
      return {
        id: item.id,
        kind: 'sound' as const,
        title: item.title,
        sizeBytes: item.fileSizeBytes != null ? Number(item.fileSizeBytes) : null,
        createdAt: item.createdAt,
        contentType: item.contentType,
        isPublic: item.isPublic,
        isAudio: key != null,
        previewUrl: key ? await presignedGetUrl(key, 3600) : null,
      }
    }),
  )

  const stashRows: UserFileRow[] = await Promise.all(
    stashFiles.map(async (file) => {
      const audio = isAudioStashFile({ contentType: file.contentType, format: file.format })
      return {
        id: file.id,
        kind: 'stash' as const,
        title: file.filename,
        sizeBytes: Number(file.sizeBytes),
        createdAt: file.createdAt,
        contentType: file.format ?? file.contentType,
        isPublic: null,
        isAudio: audio,
        previewUrl: audio ? await presignedGetUrl(file.objectKey, 3600) : null,
      }
    }),
  )

  const merged = [...soundRows, ...stashRows].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )
  const totals = computeRunningTotals(merged.map((f) => f.sizeBytes))
  return merged.map((f, i) => ({ ...f, runningTotalBytes: totals[i]! }))
}
