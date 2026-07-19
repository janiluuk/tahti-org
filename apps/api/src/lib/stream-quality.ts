// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'

// M20: listener stream quality follows the artist's tier (not the listener's).

export function liveHlsManifestPath(slug: string, tier: ArtistTier): string {
  // FLAC muxed into MPEG-TS (the stream-flac variant's container) has no
  // MediaSource Extensions support in any mainstream browser — confirmed via
  // MediaSource.isTypeSupported, false everywhere MP3/AAC-in-TS are true — so
  // this variant is silently unplayable, not just lower quality. Tahti Radio's
  // tier is STUDIO purely to exempt it from the weekly live-hour cap (see
  // seed-tahti-radio-rotation.ts), not because it should offer a FLAC stream,
  // so it always gets the working MP3 variant regardless of tier.
  const variant =
    slug !== TAHTI_RADIO_SLUG && isUnlimitedLiveTier(tier) ? 'stream-flac' : 'stream-mp3-192'
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
