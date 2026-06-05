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

/** Collapse consecutive identical fingerprints into track-boundary hints for archive tracklists. */
export function fingerprintsToTracklistEntries(
  segments: LiveFingerprintSegment[],
): TracklistEntry[] {
  const boundaries: LiveFingerprintSegment[] = []
  let lastFingerprint = ''

  for (const seg of segments) {
    if (seg.fingerprint === lastFingerprint) continue
    lastFingerprint = seg.fingerprint
    boundaries.push(seg)
  }

  if (boundaries.length === 0) return []

  return boundaries.map((seg, idx) => ({
    startSec: seg.offsetSec,
    title: idx === 0 ? 'Broadcast start' : `Track change (${formatTrackTime(seg.offsetSec)})`,
  }))
}
