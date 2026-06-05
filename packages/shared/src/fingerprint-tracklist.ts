// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fingerprintBoundaries, fingerprintsToTracklistEntries } from './broadcast-fingerprint.js'
import { parseAcoustidLookupResponse } from './acoustid.js'
import type { LiveFingerprintSegment } from './dto/broadcast-fingerprint.js'
import type { TracklistEntry } from './dto/archive-metadata.js'

const ACOUSTID_LOOKUP_URL = 'https://api.acoustid.org/v2/lookup'

export type AcoustidLookupFn = (seg: LiveFingerprintSegment) => Promise<{
  title: string
  artist?: string
} | null>

/** STREAM-008 phase 3: resolve chromaprint segments via AcoustID (optional when API key unset). */
export async function lookupAcoustidTrack(
  seg: LiveFingerprintSegment,
  opts?: { apiKey?: string; fetchFn?: typeof fetch },
): Promise<{ title: string; artist?: string } | null> {
  const apiKey = opts?.apiKey?.trim()
  if (!apiKey) return null

  const fetchFn = opts?.fetchFn ?? fetch
  const body = new URLSearchParams({
    client: apiKey,
    meta: 'recordings',
    duration: String(seg.durationSec),
    fingerprint: seg.fingerprint,
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

  const match = parseAcoustidLookupResponse(json)
  if (!match) return null

  return {
    title: match.title,
    ...(match.artist ? { artist: match.artist } : {}),
  }
}

/** Identify boundary segments, deduplicating lookups by fingerprint within one broadcast. */
export async function identifyFingerprintBoundaries(
  segments: LiveFingerprintSegment[],
  lookup: AcoustidLookupFn,
): Promise<Array<{ title: string; artist?: string } | null>> {
  const boundaries = fingerprintBoundaries(segments)
  const cache = new Map<string, { title: string; artist?: string } | null>()
  const identifications: Array<{ title: string; artist?: string } | null> = []

  for (const seg of boundaries) {
    if (seg.title) {
      identifications.push({
        title: seg.title,
        ...(seg.artist ? { artist: seg.artist } : {}),
      })
      continue
    }

    if (!cache.has(seg.fingerprint)) {
      cache.set(seg.fingerprint, await lookup(seg))
    }
    identifications.push(cache.get(seg.fingerprint) ?? null)
  }

  return identifications
}

export async function buildTracklistFromFingerprints(
  segments: LiveFingerprintSegment[],
  lookup: AcoustidLookupFn,
): Promise<TracklistEntry[]> {
  const identifications = await identifyFingerprintBoundaries(segments, lookup)
  return fingerprintsToTracklistEntries(segments, identifications)
}
