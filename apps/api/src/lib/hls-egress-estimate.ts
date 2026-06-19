// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'

/** STREAM-006 interim: bytes/sec if one listener consumed the full live stream at tier bitrate. */
export function estimatedLiveBytesPerSecond(tier: ArtistTier): number {
  const kbps = isUnlimitedLiveTier(tier) ? 1411 : 192
  return Math.floor((kbps * 1000) / 8)
}

export function estimateLiveHlsBytes(liveSeconds: number, tier: ArtistTier): number {
  if (liveSeconds <= 0) return 0
  return Math.floor(liveSeconds * estimatedLiveBytesPerSecond(tier))
}

export const LIVE_HLS_ESTIMATE_NOTE =
  'Live HLS is estimated at one listener × tier bitrate (192 kbps MP3 free-tier, ~1411 kbps FLAC membership). Edge byte counters appear when Caddy access logs are enabled.'

export const LIVE_HLS_MEASURED_NOTE =
  'Live HLS includes measured bytes from Caddy edge logs (stream.tahti.live). Days without edge data still use the one-listener bitrate estimate.'
