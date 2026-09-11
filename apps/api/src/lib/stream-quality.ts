// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'

// M20: listener stream quality follows the artist's tier (not the listener's).

export function liveHlsManifestPath(slug: string, tier: ArtistTier): string {
  // hls-minio-sync generates this master playlist from the flat Liquidsoap
  // media playlists. It advertises MP3 192 kbps and AAC 320 kbps; the FLAC
  // MPEG-TS rendition remains available for diagnostics but is excluded because
  // mainstream browser MSE does not decode that container/codec pair.
  return `${slug}/${tier === 'FREE' ? 'master-free' : 'master'}.m3u8`
}

export function liveHlsUrl(baseUrl: string, slug: string, tier: ArtistTier): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${liveHlsManifestPath(slug, tier)}`
}
