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

/**
 * Fuller match for original-track uploads: unlike parseAcoustidLookupResponse
 * (live-broadcast tracklist, title/artist only), this also surfaces the
 * MusicBrainz recording UUID (when AcoustID has one linked) and keeps a match
 * even when the fingerprint is known to AcoustID but has no recording
 * metadata attached yet — that's still a useful "this audio isn't novel"
 * signal for a copyright-conflict check.
 */
export type AcoustidFullMatch = {
  acoustidId: string
  score: number
  recordingId?: string
  title?: string
  artist?: string
}

type AcoustidFullRecording = { id?: string; title?: string; artists?: AcoustidArtist[] }
type AcoustidFullResult = { id?: string; score?: number; recordings?: AcoustidFullRecording[] }

export function parseAcoustidFullLookupResponse(body: unknown): AcoustidFullMatch | null {
  if (!body || typeof body !== 'object') return null
  const results = (body as { results?: AcoustidFullResult[] }).results
  if (!Array.isArray(results) || results.length === 0) return null

  let best: AcoustidFullMatch | null = null

  for (const result of results) {
    if (!result.id) continue
    const score = typeof result.score === 'number' ? result.score : 0
    const recording = result.recordings?.find((r) => typeof r.title === 'string')
    const artist = recording?.artists?.map((a) => a.name?.trim()).find(Boolean)

    const match: AcoustidFullMatch = {
      acoustidId: result.id,
      score,
      ...(recording?.id ? { recordingId: recording.id } : {}),
      ...(recording?.title ? { title: recording.title.trim() } : {}),
      ...(artist ? { artist } : {}),
    }

    if (!best || match.score > best.score) best = match
  }

  return best
}

const ACOUSTID_LOOKUP_URL = 'https://api.acoustid.org/v2/lookup'

/** Full-track fingerprint lookup for an uploaded original (not a live broadcast segment). */
export async function lookupAcoustidFullTrack(
  fingerprint: string,
  durationSec: number,
  opts: { apiKey: string; fetchFn?: typeof fetch },
): Promise<AcoustidFullMatch | null> {
  const apiKey = opts.apiKey.trim()
  if (!apiKey) return null

  const fetchFn = opts.fetchFn ?? fetch
  const body = new URLSearchParams({
    client: apiKey,
    meta: 'recordings',
    duration: String(Math.round(durationSec)),
    fingerprint,
  })

  let res: Response
  try {
    res = await fetchFn(ACOUSTID_LOOKUP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }

  return parseAcoustidFullLookupResponse(json)
}
