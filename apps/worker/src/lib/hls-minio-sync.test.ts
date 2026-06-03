// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('./minio.js', () => ({
  s3: { send: vi.fn().mockResolvedValue({}) },
}))

import { syncChannelHlsToMinio } from './hls-minio-sync.js'
import { s3 } from './minio.js'

describe('syncChannelHlsToMinio', () => {
  const root = join(tmpdir(), `tahti-hls-sync-${process.pid}`)
  const channelId = 'ch-abc'
  const slug = 'demo-artist'

  beforeAll(async () => {
    await mkdir(join(root, channelId, 'stream-mp3-192'), { recursive: true })
    await writeFile(join(root, channelId, 'stream-mp3-192', 'seg.ts'), Buffer.alloc(8))
    await writeFile(join(root, channelId, 'stream.m3u8'), '#EXTM3U\n')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('uploads segment files under slug prefix', async () => {
    const result = await syncChannelHlsToMinio(root, channelId, slug)
    expect(result.uploaded).toBeGreaterThan(0)
    expect(s3.send).toHaveBeenCalled()
  })
})
