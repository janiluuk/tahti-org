// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { liveHlsManifestPath, liveHlsUrl } from './stream-quality.js'

// output.file.hls writes each variant flat as "{name}.m3u8" directly in the
// channel dir (no per-variant subfolder), and hls-minio-sync mirrors that
// layout verbatim — these paths must match what's actually on disk/in MinIO,
// not an assumed structure. See infra/liquidsoap-channel.liq.template and
// apps/worker/src/lib/hls-minio-sync.ts.
describe('stream-quality', () => {
  it('uses the MP3 manifest for FREE tier', () => {
    expect(liveHlsManifestPath('dj', 'FREE')).toBe('dj/stream-mp3-192.m3u8')
  })

  it('uses the MP3 manifest for unlimited-live tiers too', () => {
    // FLAC-in-MPEGTS has no MediaSource Extensions support in mainstream
    // browsers — silently unplayable, not just lower quality (confirmed via
    // ffprobe: the muxed segments carry an unregistered MPEG-TS stream type).
    // Previously only Tahti Radio was exempted from the FLAC variant; every
    // other unlimited-tier artist's live audience got silent audio the moment
    // they went live. Always MP3 until FLAC is re-muxed into fMP4/CMAF.
    expect(liveHlsManifestPath('dj', 'ARTIST')).toBe('dj/stream-mp3-192.m3u8')
    expect(liveHlsManifestPath('dj', 'STUDIO')).toBe('dj/stream-mp3-192.m3u8')
  })

  it('builds full HLS URL without double slashes', () => {
    expect(liveHlsUrl('http://hls.example/hls-live/', 'dj', 'FREE')).toBe(
      'http://hls.example/hls-live/dj/stream-mp3-192.m3u8',
    )
  })

  it('uses the MP3 manifest for Tahti Radio at STUDIO tier', () => {
    expect(liveHlsManifestPath('tahti-radio', 'STUDIO')).toBe('tahti-radio/stream-mp3-192.m3u8')
  })
})
