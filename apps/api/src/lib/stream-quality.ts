// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'

// M20: listener stream quality follows the artist's tier (not the listener's).

export function liveHlsManifestPath(slug: string, tier: ArtistTier): string {
  const variant = isUnlimitedLiveTier(tier) ? 'stream-flac' : 'stream-mp3-192'
  // output.file.hls writes each variant as a flat "{name}.m3u8" (+ "{name}_N.ts"
  // segments) directly in the channel's directory — no per-variant subfolder —
  // and hls-minio-sync mirrors that layout verbatim into MinIO. A nested
  // "{variant}/stream.m3u8" path here never matches an object that exists.
  return `${slug}/${variant}.m3u8`
}

export function liveHlsUrl(baseUrl: string, slug: string, tier: ArtistTier): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${liveHlsManifestPath(slug, tier)}`
}
