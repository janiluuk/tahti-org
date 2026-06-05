// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Parsed track metadata from an AcoustID lookup (MusicBrainz recording). */
export type AcoustidTrackMatch = {
  title: string
  artist?: string
  score: number
}

type AcoustidArtist = { name?: string }
type AcoustidRecording = { title?: string; artists?: AcoustidArtist[] }
type AcoustidResult = { score?: number; recordings?: AcoustidRecording[] }

/** Best-effort parse of AcoustID v2 lookup JSON (https://acoustid.org/chromaprint). */
export function parseAcoustidLookupResponse(body: unknown): AcoustidTrackMatch | null {
  if (!body || typeof body !== 'object') return null
  const results = (body as { results?: AcoustidResult[] }).results
  if (!Array.isArray(results) || results.length === 0) return null

  let best: AcoustidTrackMatch | null = null

  for (const result of results) {
    const score = typeof result.score === 'number' ? result.score : 0
    const recording = result.recordings?.find(
      (r) => typeof r.title === 'string' && r.title.length > 0,
    )
    if (!recording?.title) continue

    const artist = recording.artists?.map((a) => a.name?.trim()).find(Boolean)
    const match: AcoustidTrackMatch = {
      title: recording.title.trim(),
      ...(artist ? { artist } : {}),
      score,
    }

    if (!best || match.score > best.score) best = match
  }

  return best
}
