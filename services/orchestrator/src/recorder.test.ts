// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  broadcastRecordingPath,
  buildRecorderDockerCommand,
  recorderInputUrl,
  recorderContainerName,
} from './recorder.js'

describe('recorderInputUrl', () => {
  it('uses Icecast mount for ICECAST source', () => {
    expect(recorderInputUrl('ICECAST', 'artist-one')).toBe('http://icecast:8000/live/artist-one')
  })

  it('uses edge encoder relay for RTMP source', () => {
    expect(recorderInputUrl('RTMP', 'artist-one', 'secret-key')).toBe(
      'http://tahti-edge-artist-one:8090/stream',
    )
  })
})

describe('buildRecorderDockerCommand', () => {
  it('writes predictable broadcast wav path', () => {
    const cmd = buildRecorderDockerCommand({
      containerName: 'tahti-recorder-test-bc123',
      channelId: 'ch-1',
      broadcastId: 'bc-1',
      inputUrl: 'rtmp://rtmp-ingest:1935/live/artist-one__key',
    })
    expect(cmd).toContain('tahti-recorder-test-bc123')
    expect(cmd).toContain(broadcastRecordingPath('ch-1', 'bc-1'))
    expect(cmd).toContain('rtmp://rtmp-ingest:1935/live/artist-one__key')
  })
})

describe('recorderContainerName', () => {
  it('includes slug and broadcast id prefix', () => {
    expect(recorderContainerName('my-artist', 'broadcast-uuid-123')).toMatch(
      /^tahti-recorder-my-artist-/,
    )
  })
})
