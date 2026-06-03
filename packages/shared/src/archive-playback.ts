// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

/** ffprobe format names for lossless uploads — keep FLAC, do not derive MP3. */
export const LOSSLESS_SOURCE_FORMATS = [
  'wav',
  'flac',
  'aiff',
  'pcm_s16le',
  'pcm_s24le',
  'pcm_s32le',
] as const

export function isLosslessSource(format: string): boolean {
  const fmt = format.toLowerCase()
  return LOSSLESS_SOURCE_FORMATS.some((f) => fmt.includes(f))
}

/** Object key for playback, RSS, and default downloads (MP3 when present, else FLAC). */
export function archivePlaybackKey(item: {
  mp3Key: string | null
  flacKey: string | null
}): string | null {
  return item.mp3Key ?? item.flacKey
}
