// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  buildEdgeEncoderDockerCommand,
  edgeEncoderContainerName,
  edgeEncoderRelayUrl,
  rtmpIngestUrl,
} from './edge-encoder.js'

describe('rtmpIngestUrl', () => {
  it('builds nginx-rtmp stream name with slug__key', () => {
    expect(rtmpIngestUrl('artist-one', 'secret')).toBe(
      'rtmp://rtmp-ingest:1935/live/artist-one__secret',
    )
  })

  it('uses slug alone when stream key is absent', () => {
    expect(rtmpIngestUrl('artist-one', null)).toBe('rtmp://rtmp-ingest:1935/live/artist-one')
  })
})

describe('edgeEncoderContainerName', () => {
  it('is stable per channel slug (not per broadcast)', () => {
    expect(edgeEncoderContainerName('my-artist')).toBe('tahti-edge-my-artist')
  })
})

describe('edgeEncoderRelayUrl', () => {
  it('points Liquidsoap at the per-channel ffmpeg HTTP listener', () => {
    expect(edgeEncoderRelayUrl('artist-one')).toBe('http://tahti-edge-artist-one:8090/stream')
  })
})

describe('buildEdgeEncoderDockerCommand', () => {
  it('normalizes RTMP to MP3 HTTP relay', () => {
    const cmd = buildEdgeEncoderDockerCommand({
      containerName: edgeEncoderContainerName('artist-one'),
      rtmpInputUrl: rtmpIngestUrl('artist-one', 'key'),
    })
    expect(cmd).toContain('tahti-edge-artist-one')
    expect(cmd).toContain('libmp3lame')
    expect(cmd).toContain('http://0.0.0.0:8090/stream')
    expect(cmd).toContain('rtmp://rtmp-ingest:1935/live/artist-one__key')
    expect(cmd).toContain('-reconnect 1')
    expect(cmd).toContain('-listen 1')
  })
})
