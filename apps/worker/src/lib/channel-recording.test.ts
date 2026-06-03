// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findLatestChannelRecording } from './channel-recording.js'

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
})
