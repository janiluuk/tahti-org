// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  findChannelBroadcastRecording,
  findLatestChannelRecording,
  broadcastRecordingFileName,
} from './channel-recording.js'

describe('findChannelBroadcastRecording', () => {
  const root = join(tmpdir(), `tahti-rec-bc-${Date.now()}`)
  const channelId = 'ch-test'
  const broadcastId = 'bc-sidecar'

  beforeAll(async () => {
    await mkdir(join(root, channelId), { recursive: true })
    await writeFile(join(root, channelId, broadcastRecordingFileName(broadcastId)), 'sidecar')
    await writeFile(join(root, channelId, 'legacy.wav'), 'legacy')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('prefers ffmpeg sidecar file over legacy timestamped wav', async () => {
    const path = await findChannelBroadcastRecording(
      root,
      channelId,
      broadcastId,
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(path).toContain(`broadcast-${broadcastId}.wav`)
  })

  it('falls back to legacy wav when sidecar file is missing', async () => {
    const legacyRoot = join(tmpdir(), `tahti-rec-legacy-${Date.now()}`)
    const legacyChannel = 'ch-legacy'
    await mkdir(join(legacyRoot, legacyChannel), { recursive: true })
    await writeFile(join(legacyRoot, legacyChannel, 'live_20260601.wav'), 'x'.repeat(400))

    const path = await findChannelBroadcastRecording(
      legacyRoot,
      legacyChannel,
      'bc-missing',
      new Date('2026-01-01T00:00:00Z'),
    )

    expect(path).toContain('live_20260601.wav')
    await rm(legacyRoot, { recursive: true, force: true })
  })

  it('ignores empty sidecar and uses legacy wav', async () => {
    const emptyRoot = join(tmpdir(), `tahti-rec-empty-${Date.now()}`)
    const emptyChannel = 'ch-empty'
    const bcId = 'bc-empty'
    await mkdir(join(emptyRoot, emptyChannel), { recursive: true })
    await writeFile(join(emptyRoot, emptyChannel, broadcastRecordingFileName(bcId)), '')
    await writeFile(join(emptyRoot, emptyChannel, 'live_new.wav'), 'x'.repeat(400))

    const path = await findChannelBroadcastRecording(
      emptyRoot,
      emptyChannel,
      bcId,
      new Date('2026-01-01T00:00:00Z'),
    )

    expect(path).toContain('live_new.wav')
    await rm(emptyRoot, { recursive: true, force: true })
  })
})

describe('findLatestChannelRecording', () => {
  const root = join(tmpdir(), `tahti-rec-test-${Date.now()}`)
  const channelId = 'ch-test'

  beforeAll(async () => {
    await mkdir(join(root, channelId), { recursive: true })
    const old = new Date('2020-01-01T00:00:00Z')
    await writeFile(join(root, channelId, 'old.wav'), 'x')
    const oldPath = join(root, channelId, 'old.wav')
    const { utimes } = await import('node:fs/promises')
    await utimes(oldPath, old, old)

    await writeFile(join(root, channelId, 'new.wav'), 'x'.repeat(400))
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns newest wav after broadcast start', async () => {
    const path = await findLatestChannelRecording(root, channelId, new Date('2026-01-01T00:00:00Z'))
    expect(path).toContain('new.wav')
  })

  it('ignores broadcast sidecar files when scanning legacy wavs', async () => {
    await writeFile(join(root, channelId, 'broadcast-bc-old.wav'), 'x'.repeat(500))

    const path = await findLatestChannelRecording(root, channelId, new Date('2026-01-01T00:00:00Z'))
    expect(path).toContain('new.wav')
    expect(path).not.toContain('broadcast-')
  })
})
