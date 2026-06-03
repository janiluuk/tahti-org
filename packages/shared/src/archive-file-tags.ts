// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { ARCHIVE_GENRES, ARCHIVE_METADATA_DEFAULTS } from './dto/archive-metadata.js'

export type ParsedArchiveFileTags = {
  bpm: number | null
  key: string | null
  genre: string | null
  description: string | null
  recordingLocation: string | null
  mixVersion: string | null
}

function tagValue(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(tags)) {
      if (k.toLowerCase() === key.toLowerCase() && v != null && String(v).trim()) {
        return String(v).trim()
      }
    }
  }
  return null
}

function parseBpm(raw: string | null): number | null {
  if (!raw) return null
  const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
  return n >= 40 && n <= 300 ? n : null
}

function parseKey(raw: string | null): string | null {
  if (!raw) return null
  const key = raw.trim().slice(0, 12)
  return key.length > 0 ? key : null
}

/** Normalize ffprobe ID3/Vorbis tag map into archive metadata fields. */
export function parseArchiveFileTags(tags: Record<string, unknown>): ParsedArchiveFileTags {
  return {
    bpm: parseBpm(tagValue(tags, 'TBPM', 'bpm', 'BPM', 'tmpo')),
    key: parseKey(tagValue(tags, 'TKEY', 'initialkey', 'KEY', 'key')),
    genre: tagValue(tags, 'TCON', 'genre', 'GENRE'),
    description: tagValue(tags, 'comment', 'COMMENT', 'description', 'DESCRIPTION'),
    recordingLocation: tagValue(tags, 'location', 'TLOC'),
    mixVersion: tagValue(tags, 'version', 'TVER'),
  }
}

function mapGenre(raw: string): { genre?: string; genreCustom?: string } {
  const trimmed = raw.trim().slice(0, 80)
  if (!trimmed) return {}
  const preset = ARCHIVE_GENRES.find((g) => g.toLowerCase() === trimmed.toLowerCase())
  if (preset) return { genre: preset }
  return { genreCustom: trimmed }
}

export type ArchiveItemForTagMerge = {
  description: string | null
  genre: string | null
  genreCustom: string | null
  recordingLocation: string | null
  mixVersion: string | null
  useDetectedBpmKey: boolean
}

/** Prefer embedded tags; fill BPM/key from acoustic analysis when missing. */
export function mergeParsedArchiveTags(
  embedded: ParsedArchiveFileTags,
  acoustic: Pick<ParsedArchiveFileTags, 'bpm' | 'key'>,
): ParsedArchiveFileTags {
  return {
    ...embedded,
    bpm: embedded.bpm ?? acoustic.bpm ?? null,
    key: embedded.key ?? acoustic.key ?? null,
  }
}

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Map fundamental frequency (Hz) to a pitch class label, e.g. 440 → "A". */
export function frequencyToPitchClass(hz: number): string | null {
  if (!Number.isFinite(hz) || hz < 20 || hz > 5000) return null
  const midi = Math.round(12 * Math.log2(hz / 440) + 69)
  const idx = ((midi % 12) + 12) % 12
  return PITCH_CLASS_NAMES[idx] ?? null
}

/**
 * Fill empty metadata fields from embedded file tags.
 * Skipped entirely when `useDetectedBpmKey` is false (artist opts out of auto tags).
 */
export function mergeDetectedArchiveMetadata(
  item: ArchiveItemForTagMerge,
  detected: ParsedArchiveFileTags,
): Record<string, unknown> {
  if (!item.useDetectedBpmKey) return {}

  const patch: Record<string, unknown> = {}

  if (!item.description?.trim() && detected.description) {
    patch.description = detected.description.slice(0, 2000)
  }
  if (!item.recordingLocation?.trim() && detected.recordingLocation) {
    patch.recordingLocation = detected.recordingLocation.slice(0, 120)
  }
  if (!item.mixVersion?.trim() && detected.mixVersion) {
    patch.mixVersion = detected.mixVersion.slice(0, 120)
  }

  const genreUnset =
    !item.genreCustom?.trim() &&
    (!item.genre?.trim() || item.genre === ARCHIVE_METADATA_DEFAULTS.genre)
  if (genreUnset && detected.genre) {
    Object.assign(patch, mapGenre(detected.genre))
  }

  return patch
}
