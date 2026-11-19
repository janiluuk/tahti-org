// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  broadcastRecordingPath,
  buildRecorderDockerCommand,
  recorderInputUrl,
  recorderContainerName,
  resetActiveRecordersForTests,
  spawnBroadcastRecorder,
} from './recorder.js'

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return {
    ...actual,
    exec: vi.fn(
      (_cmd: string, cb?: (err: Error | null, stdout: string, stderr: string) => void) => {
        cb?.(null, '', '')
        return {} as never
      },
    ),
    execFile: vi.fn(
      (
        _file: string,
        args: string[],
        cb?: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const running =
          args.includes('inspect') && args.includes('tahti-recorder-artist-abc123')
            ? 'false'
            : 'false'
        cb?.(null, running, '')
        return {} as never
      },
    ),
  }
})

describe('recorderInputUrl', () => {
  it('uses Icecast mount for ICECAST source', () => {
    expect(recorderInputUrl('ICECAST', 'artist-one')).toBe('http://icecast:8000/live/artist-one')
  })

  it('uses edge encoder relay for RTMP source', () => {
    expect(recorderInputUrl('RTMP', 'artist-one', 'secret-key')).toBe(
      'http://tahti-edge-artist-one:8090/stream',
    )
  })

  it('uses Icecast mount for WEBRTC until relay exists', () => {
    expect(recorderInputUrl('WEBRTC', 'artist-one')).toBe('http://icecast:8000/live/artist-one')
  })
})

describe('broadcastRecordingPath', () => {
  it('is stable per channel and broadcast', () => {
    expect(broadcastRecordingPath('ch-1', 'bc-abc')).toBe('/recordings/ch-1/broadcast-bc-abc.wav')
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

  it('reconnects HTTP inputs and writes 24-bit PCM wav', () => {
    const cmd = buildRecorderDockerCommand({
      containerName: 'tahti-recorder-x',
      channelId: 'ch-1',
      broadcastId: 'bc-1',
      inputUrl: 'http://tahti-edge-artist-one:8090/stream',
    })
    expect(cmd).toContain('-reconnect 1')
    expect(cmd).toContain('pcm_s24le')
    expect(cmd).toContain('--restart=no')
  })
})

describe('recorderContainerName', () => {
  it('includes slug and broadcast id prefix', () => {
    expect(recorderContainerName('my-artist', 'broadcast-uuid-123')).toMatch(
      /^tahti-recorder-my-artist-/,
    )
  })
})

describe('spawnBroadcastRecorder reconnect', () => {
  afterEach(() => {
    resetActiveRecordersForTests()
    vi.clearAllMocks()
  })

  it('respawns when the previous sidecar for the same broadcast has exited', async () => {
    const { exec } = await import('node:child_process')
    const execMock = vi.mocked(exec)

    await spawnBroadcastRecorder('ch-1', 'artist', 'abc123broadcast', 'ICECAST')
    expect(execMock).toHaveBeenCalled()
    const firstSpawnCalls = execMock.mock.calls.length

    await spawnBroadcastRecorder('ch-1', 'artist', 'abc123broadcast', 'ICECAST')
    expect(execMock.mock.calls.length).toBeGreaterThan(firstSpawnCalls)
  })
})
