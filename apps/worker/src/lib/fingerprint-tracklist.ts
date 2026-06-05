// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  buildTracklistFromFingerprints as buildTracklistFromFingerprintsShared,
  lookupAcoustidTrack,
  type AcoustidLookupFn,
  type LiveFingerprintSegment,
  type TracklistEntry,
} from '@tahti/shared'

export type { AcoustidLookupFn }

export { lookupAcoustidTrack }

const defaultLookup: AcoustidLookupFn = (seg) => lookupAcoustidTrack(seg)

/** Worker archive job: optional AcoustID when ACOUSTID_API_KEY is set. */
export async function buildTracklistFromFingerprints(
  segments: LiveFingerprintSegment[],
  lookup: AcoustidLookupFn = defaultLookup,
): Promise<TracklistEntry[]> {
  return buildTracklistFromFingerprintsShared(segments, lookup)
}
