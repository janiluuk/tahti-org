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
  it('uses MP3 manifest for FREE tier', () => {
    expect(liveHlsManifestPath('dj', 'FREE')).toBe('dj/stream-mp3-192.m3u8')
  })

  it('uses FLAC manifest for member tiers', () => {
    expect(liveHlsManifestPath('dj', 'ARTIST')).toBe('dj/stream-flac.m3u8')
    expect(liveHlsManifestPath('dj', 'STUDIO')).toBe('dj/stream-flac.m3u8')
  })

  it('builds full HLS URL without double slashes', () => {
    expect(liveHlsUrl('http://hls.example/hls-live/', 'dj', 'FREE')).toBe(
      'http://hls.example/hls-live/dj/stream-mp3-192.m3u8',
    )
  })
})
