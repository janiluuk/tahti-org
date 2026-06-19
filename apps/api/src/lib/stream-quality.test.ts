// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { liveHlsManifestPath, liveHlsUrl } from './stream-quality.js'

describe('stream-quality', () => {
  it('uses MP3 manifest for FREE tier', () => {
    expect(liveHlsManifestPath('dj', 'FREE')).toBe('dj/stream-mp3-192/stream.m3u8')
  })

  it('uses FLAC manifest for member tiers', () => {
    expect(liveHlsManifestPath('dj', 'ARTIST')).toBe('dj/stream-flac/stream.m3u8')
    expect(liveHlsManifestPath('dj', 'STUDIO')).toBe('dj/stream-flac/stream.m3u8')
  })

  it('builds full HLS URL without double slashes', () => {
    expect(liveHlsUrl('http://hls.example/hls-live/', 'dj', 'FREE')).toBe(
      'http://hls.example/hls-live/dj/stream-mp3-192/stream.m3u8',
    )
  })
})
