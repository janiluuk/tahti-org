// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections — single source of truth for the source → quality
 * matrix. Every UI badge, download-count, and player-choice decision goes
 * through these functions instead of re-deriving the rule ad hoc.
 */

export type ArchiveItemSource =
  | 'UPLOAD'
  | 'BROADCAST'
  | 'BANDCAMP'
  | 'SOUNDCLOUD'
  | 'GOOGLE_DRIVE'
  | 'MIXCLOUD_RESCUE'
  | 'SPOTIFY_EMBED'
  | 'MIXCLOUD_EMBED'
  | 'URL_EMBED'

export type ArchiveQualityBadge = 'LOSSLESS' | 'TRANSCODED' | 'EMBED_ONLY'

export type ArchiveEmbedProvider = 'SPOTIFY' | 'MIXCLOUD' | 'YOUTUBE' | 'APPLE' | 'GENERIC'

const EMBED_ONLY_SOURCES: ReadonlySet<ArchiveItemSource> = new Set([
  'SPOTIFY_EMBED',
  'MIXCLOUD_EMBED',
  'URL_EMBED',
])

export function isEmbedOnlySource(source: ArchiveItemSource): boolean {
  return EMBED_ONLY_SOURCES.has(source)
}

/**
 * Quality badge for a newly-created (or re-probed) ArchiveItem.
 * `hasFlac` is the caller's own determination of whether a lossless
 * FLAC/WAV-derived file exists — this function only encodes the matrix,
 * not the ffprobe analysis that produces `hasFlac` (see archive-playback.ts).
 */
export function deriveQualityBadge(source: ArchiveItemSource, hasFlac: boolean): ArchiveQualityBadge {
  if (isEmbedOnlySource(source)) return 'EMBED_ONLY'
  // Mixcloud only ever serves transcoded M4A — there is no source to make a lossless copy from.
  if (source === 'MIXCLOUD_RESCUE') return 'TRANSCODED'
  return hasFlac ? 'LOSSLESS' : 'TRANSCODED'
}

export type ArchivePlayerKind = 'TAHTI' | 'SPOTIFY_EMBED' | 'MIXCLOUD_EMBED' | 'GENERIC_EMBED'

export function playerKindForSource(source: ArchiveItemSource): ArchivePlayerKind {
  switch (source) {
    case 'SPOTIFY_EMBED':
      return 'SPOTIFY_EMBED'
    case 'MIXCLOUD_EMBED':
      return 'MIXCLOUD_EMBED'
    case 'URL_EMBED':
      return 'GENERIC_EMBED'
    default:
      return 'TAHTI'
  }
}

export const QUALITY_BADGE_LABEL: Record<ArchiveQualityBadge, string> = {
  LOSSLESS: 'Lossless',
  TRANSCODED: 'Transcoded',
  EMBED_ONLY: 'Embed only',
}

/** Whether this item should count toward "Download FLAC (N tracks)" on a public collection page. */
export function countsTowardFlacDownload(qualityBadge: ArchiveQualityBadge): boolean {
  return qualityBadge === 'LOSSLESS'
}
