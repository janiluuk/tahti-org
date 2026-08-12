// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('./minio.js', () => ({
  s3: { send: mockSend },
}))

import { hlsObjectUpToDate, resetHlsUploadCache, syncChannelHlsToMinio } from './hls-minio-sync.js'

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

  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({})
    resetHlsUploadCache()
  })

  it('uploads segment files under slug prefix', async () => {
    const result = await syncChannelHlsToMinio(root, channelId, slug)
    expect(result.uploaded).toBeGreaterThan(0)
    expect(mockSend.mock.calls.some(([cmd]) => cmd instanceof PutObjectCommand)).toBe(true)
  })

  it('skips objects already mirrored at the same size and mtime', async () => {
    // First pass uploads and records fingerprints.
    await syncChannelHlsToMinio(root, channelId, slug)
    mockSend.mockClear()

    const result = await syncChannelHlsToMinio(root, channelId, slug)
    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('uploads playlists after segments', async () => {
    await syncChannelHlsToMinio(root, channelId, slug)
    const putKeys = mockSend.mock.calls
      .filter(([cmd]) => cmd instanceof PutObjectCommand)
      .map(([cmd]) => (cmd as PutObjectCommand).input.Key as string)
    const lastSeg = putKeys
      .map((k, i) => ({ k, i }))
      .filter((x) => x.k.endsWith('.ts'))
      .pop()
    const firstPl = putKeys.map((k, i) => ({ k, i })).find((x) => x.k.endsWith('.m3u8'))
    expect(lastSeg && firstPl && lastSeg.i < firstPl.i).toBe(true)
  })
})

describe('hlsObjectUpToDate', () => {
  beforeEach(() => {
    resetHlsUploadCache()
  })

  it('returns false when nothing has been uploaded yet', () => {
    expect(hlsObjectUpToDate('slug/seg.ts', 100, Date.now())).toBe(false)
  })

  it('returns true after a matching upload is recorded via sync', async () => {
    const root = join(tmpdir(), `tahti-hls-fp-${process.pid}`)
    const channelId = 'ch-fp'
    const slug = 'fp'
    await mkdir(join(root, channelId), { recursive: true })
    await writeFile(join(root, channelId, 'seg.ts'), Buffer.alloc(8))
    mockSend.mockResolvedValue({})
    await syncChannelHlsToMinio(root, channelId, slug)
    const { mtimeMs } = await import('node:fs/promises').then((fs) =>
      fs.stat(join(root, channelId, 'seg.ts')),
    )
    expect(hlsObjectUpToDate(`${slug}/seg.ts`, 8, mtimeMs)).toBe(true)
    await rm(root, { recursive: true, force: true })
  })
})
