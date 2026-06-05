// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { LiveFingerprintSegment } from './dto/broadcast-fingerprint.js'
import type { TracklistEntry } from './dto/archive-metadata.js'

export function broadcastFingerprintRedisKey(broadcastId: string): string {
  return `broadcast:fp:${broadcastId}`
}

function formatTrackTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type FingerprintTrackIdentification = {
  title: string
  artist?: string
}

/** Collapse consecutive identical fingerprints into boundary segments (one per track change). */
export function fingerprintBoundaries(
  segments: LiveFingerprintSegment[],
): LiveFingerprintSegment[] {
  const boundaries: LiveFingerprintSegment[] = []
  let lastFingerprint = ''

  for (const seg of segments) {
    if (seg.fingerprint === lastFingerprint) continue
    lastFingerprint = seg.fingerprint
    boundaries.push(seg)
  }

  return boundaries
}

/** Collapse consecutive identical fingerprints into track-boundary hints for archive tracklists. */
export function fingerprintsToTracklistEntries(
  segments: LiveFingerprintSegment[],
  identifications?: Array<FingerprintTrackIdentification | null | undefined>,
): TracklistEntry[] {
  const boundaries = fingerprintBoundaries(segments)
  if (boundaries.length === 0) return []

  return boundaries.map((seg, idx) => {
    if (seg.title) {
      return {
        startSec: seg.offsetSec,
        title: seg.title,
        ...(seg.artist ? { artist: seg.artist } : {}),
      }
    }

    const identified = identifications?.[idx]
    if (identified?.title) {
      return {
        startSec: seg.offsetSec,
        title: identified.title,
        ...(identified.artist ? { artist: identified.artist } : {}),
      }
    }

    return {
      startSec: seg.offsetSec,
      title: idx === 0 ? 'Broadcast start' : `Track change (${formatTrackTime(seg.offsetSec)})`,
    }
  })
}
