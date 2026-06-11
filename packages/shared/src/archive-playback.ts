// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

/** ffprobe codec names for lossless audio streams — covers ALAC inside .m4a/.mov containers. */
export const LOSSLESS_CODECS = [
  'flac',
  'alac',
  'pcm_s16le',
  'pcm_s16be',
  'pcm_s24le',
  'pcm_s24be',
  'pcm_s32le',
  'pcm_s32be',
  'pcm_f32le',
  'wavpack',
] as const

export function isLosslessCodec(codec: string | null | undefined): boolean {
  if (!codec) return false
  const c = codec.toLowerCase()
  return LOSSLESS_CODECS.some((f) => c.includes(f))
}

/** Human-readable source format label derived from the ffprobe audio codec name. */
export function sourceFormatLabel(codec: string | null | undefined): string | null {
  if (!codec) return null
  const c = codec.toLowerCase()
  if (c.includes('flac')) return 'FLAC'
  if (c.includes('alac')) return 'ALAC'
  if (c.startsWith('pcm') || c.includes('wavpack')) return 'WAV'
  if (c.includes('mp3')) return 'MP3'
  if (c.includes('aac')) return 'AAC'
  if (c.includes('vorbis')) return 'OGG'
  if (c.includes('opus')) return 'Opus'
  return codec.toUpperCase()
}

/** Standard LAME CBR steps, descending — used to pick an MP3 output bitrate. */
export const LOSSY_BITRATE_LADDER = [
  320, 256, 224, 192, 160, 128, 112, 96, 80, 64, 56, 48, 40, 32,
] as const

const DEFAULT_LOSSY_OUTPUT_BITRATE_KBPS = 192

/**
 * Pick an MP3 output bitrate that never exceeds the source bitrate (no
 * upscaling / no false "upgraded" quality) and never re-encodes a source
 * down below where it already sat (no needless quality loss). Falls back
 * to the historical 192k default when the source bitrate is unknown.
 */
export function chooseLossyOutputBitrateKbps(sourceBitrateKbps: number | null | undefined): number {
  if (sourceBitrateKbps == null || sourceBitrateKbps <= 0) {
    return DEFAULT_LOSSY_OUTPUT_BITRATE_KBPS
  }
  const capped = Math.min(sourceBitrateKbps, LOSSY_BITRATE_LADDER[0])
  for (const step of LOSSY_BITRATE_LADDER) {
    if (step <= capped) return step
  }
  return LOSSY_BITRATE_LADDER[LOSSY_BITRATE_LADDER.length - 1]
}

/** Object key for playback, RSS, and default downloads (MP3 when present, else FLAC). */
export function archivePlaybackKey(item: {
  mp3Key: string | null
  flacKey: string | null
}): string | null {
  return item.mp3Key ?? item.flacKey
}
