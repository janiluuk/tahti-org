// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  buildFingerprintIngestDockerCommand,
  buildFingerprintIngestShell,
  fingerprintContainerName,
} from './fingerprint-ingest.js'

describe('fingerprintContainerName', () => {
  it('is stable per slug and broadcast', () => {
    expect(fingerprintContainerName('demo', 'broadcast-abc123')).toBe('tahti-fp-demo-broadcastabc')
  })
})

describe('buildFingerprintIngestShell', () => {
  it('installs chromaprint and posts segments to internal API', () => {
    const shell = buildFingerprintIngestShell({
      inputUrl: 'http://tahti-edge-demo:8090/stream',
      broadcastId: 'bc_test',
      apiUrl: 'http://api:3001',
      internalSecret: 'dev-secret',
      intervalSec: 30,
      windowSec: 12,
    })
    expect(shell).toContain('apk add --no-cache ffmpeg chromaprint curl')
    expect(shell).toContain('fpcalc -json /tmp/w.wav')
    expect(shell).toContain('fingerprint-segment')
    expect(shell).toContain('BROADCAST_ID="bc_test"')
  })

  it('includes MP3 sample when sendAudioSample is enabled', () => {
    const shell = buildFingerprintIngestShell({
      inputUrl: 'http://tahti-edge-demo:8090/stream',
      broadcastId: 'bc_test',
      apiUrl: 'http://api:3001',
      internalSecret: 'dev-secret',
      sendAudioSample: true,
    })
    expect(shell).toContain('audioSampleBase64')
    expect(shell).toContain('/tmp/s.mp3')
  })
})

describe('buildFingerprintIngestDockerCommand', () => {
  it('runs alpine sidecar on the stack network', () => {
    const cmd = buildFingerprintIngestDockerCommand({
      containerName: fingerprintContainerName('demo', 'bc1'),
      inputUrl: 'http://icecast:8000/live/demo',
      broadcastId: 'bc1',
      apiUrl: 'http://api:3001',
      internalSecret: 'dev-secret',
    })
    expect(cmd).toContain('--network tahti-stack_default')
    expect(cmd).toContain('tahti-fp-demo-bc1')
    expect(cmd).toContain('alpine:3.20')
  })
})
