// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { liveHlsManifestPath, liveHlsUrl } from './stream-quality.js'

// output.file.hls writes each media variant flat as "{name}.m3u8" directly in
// the channel dir. hls-minio-sync generates master.m3u8 beside them and mirrors
// the layout verbatim into MinIO.
describe('stream-quality', () => {
  it('uses the ABR master manifest for FREE tier', () => {
    expect(liveHlsManifestPath('dj', 'FREE')).toBe('dj/master-free.m3u8')
  })

  it('uses the ABR master manifest for unlimited-live tiers too', () => {
    // FLAC-in-MPEGTS has no MediaSource Extensions support in mainstream
    // browsers — silently unplayable, not just lower quality (confirmed via
    // ffprobe: the muxed segments carry an unregistered MPEG-TS stream type).
    // Previously only Tahti Radio was exempted from the FLAC variant; every
    // other unlimited-tier artist's live audience got silent audio the moment
    // they went live. The master advertises only MP3/AAC until FLAC is
    // re-muxed into fMP4/CMAF.
    expect(liveHlsManifestPath('dj', 'ARTIST')).toBe('dj/master.m3u8')
    expect(liveHlsManifestPath('dj', 'STUDIO')).toBe('dj/master.m3u8')
  })

  it('builds full HLS URL without double slashes', () => {
    expect(liveHlsUrl('http://hls.example/hls-live/', 'dj', 'FREE')).toBe(
      'http://hls.example/hls-live/dj/master-free.m3u8',
    )
  })

  it('uses the ABR master manifest for Tahti Radio at STUDIO tier', () => {
    expect(liveHlsManifestPath('tahti-radio', 'STUDIO')).toBe('tahti-radio/master.m3u8')
  })
})
