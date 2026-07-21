// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'

// M20: listener stream quality follows the artist's tier (not the listener's).

export function liveHlsManifestPath(slug: string, _tier: ArtistTier): string {
  // FLAC muxed into MPEG-TS (the stream-flac variant's container, still produced
  // by output.file.hls per infra/liquidsoap-rotation.liq.template and
  // infra/liquidsoap-channel.liq.template) has no MediaSource Extensions support
  // in any mainstream browser — confirmed via MediaSource.isTypeSupported, false
  // everywhere MP3/AAC-in-TS are true, and independently via ffprobe: the muxed
  // segments carry codec_tag=0x0006 ("bin_data"), not a registered MPEG-TS
  // stream type FLAC has none of. This was previously only special-cased for
  // TAHTI_RADIO_SLUG, leaving every other unlimited-tier artist's live audience
  // silently getting an unplayable stream the moment they went live — always use
  // the working MP3 variant until the FLAC variant is re-muxed into a container
  // HLS actually supports it in (fMP4/CMAF, not mpegts).
  const variant = 'stream-mp3-192'
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
