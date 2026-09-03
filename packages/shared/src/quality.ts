// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections — single source of truth for the source → quality
 * matrix. Every UI badge, download-count, and player-choice decision goes
 * through these functions instead of re-deriving the rule ad hoc.
 */

export type SoundSource =
  | 'UPLOAD'
  | 'BROADCAST'
  | 'BANDCAMP'
  | 'SOUNDCLOUD'
  | 'GOOGLE_DRIVE'
  | 'MIXCLOUD_RESCUE'
  | 'HEARTHIS'
  | 'SPOTIFY_EMBED'
  | 'MIXCLOUD_EMBED'
  | 'HEARTHIS_EMBED'
  | 'URL_EMBED'

export type SoundQualityBadge = 'LOSSLESS' | 'TRANSCODED' | 'EMBED_ONLY'

export type SoundEmbedProvider =
  'SPOTIFY' | 'MIXCLOUD' | 'HEARTHIS' | 'YOUTUBE' | 'APPLE' | 'GENERIC'

const EMBED_ONLY_SOURCES: ReadonlySet<SoundSource> = new Set([
  'SPOTIFY_EMBED',
  'MIXCLOUD_EMBED',
  'HEARTHIS_EMBED',
  'URL_EMBED',
])

export function isEmbedOnlySource(source: SoundSource): boolean {
  return EMBED_ONLY_SOURCES.has(source)
}

/**
 * Quality badge for a newly-created (or re-probed) Sound.
 * `hasFlac` is the caller's own determination of whether a lossless
 * FLAC/WAV-derived file exists — this function only encodes the matrix,
 * not the ffprobe analysis that produces `hasFlac` (see sound-playback.ts).
 */
export function deriveQualityBadge(source: SoundSource, hasFlac: boolean): SoundQualityBadge {
  if (isEmbedOnlySource(source)) return 'EMBED_ONLY'
  // Mixcloud only ever serves transcoded M4A — there is no source to make a lossless copy from.
  if (source === 'MIXCLOUD_RESCUE') return 'TRANSCODED'
  return hasFlac ? 'LOSSLESS' : 'TRANSCODED'
}

export type SoundPlayerKind =
  'TAHTI' | 'SPOTIFY_EMBED' | 'MIXCLOUD_EMBED' | 'HEARTHIS_EMBED' | 'GENERIC_EMBED'

export function playerKindForSource(source: SoundSource): SoundPlayerKind {
  switch (source) {
    case 'SPOTIFY_EMBED':
      return 'SPOTIFY_EMBED'
    case 'MIXCLOUD_EMBED':
      return 'MIXCLOUD_EMBED'
    case 'HEARTHIS_EMBED':
      return 'HEARTHIS_EMBED'
    case 'URL_EMBED':
      return 'GENERIC_EMBED'
    default:
      return 'TAHTI'
  }
}

export const QUALITY_BADGE_LABEL: Record<SoundQualityBadge, string> = {
  LOSSLESS: 'Lossless',
  TRANSCODED: 'Transcoded',
  EMBED_ONLY: 'Embed only',
}

/** Whether this item should count toward "Download FLAC (N tracks)" on a public collection page. */
export function countsTowardFlacDownload(qualityBadge: SoundQualityBadge): boolean {
  return qualityBadge === 'LOSSLESS'
}
