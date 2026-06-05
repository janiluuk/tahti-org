// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}))

vi.mock('./minio.js', () => ({
  s3: { send: mockSend },
}))

import { hlsObjectUpToDate, syncChannelHlsToMinio } from './hls-minio-sync.js'

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
    mockSend.mockRejectedValue(Object.assign(new Error('NotFound'), { name: 'NotFound' }))
  })

  it('uploads segment files under slug prefix', async () => {
    mockSend.mockImplementation(async (cmd) => {
      if (cmd instanceof HeadObjectCommand) {
        throw Object.assign(new Error('NotFound'), { name: 'NotFound' })
      }
      return {}
    })

    const result = await syncChannelHlsToMinio(root, channelId, slug)
    expect(result.uploaded).toBeGreaterThan(0)
    expect(mockSend.mock.calls.some(([cmd]) => cmd instanceof PutObjectCommand)).toBe(true)
  })

  it('skips objects already mirrored at the same size and mtime', async () => {
    mockSend.mockImplementation(async (cmd) => {
      if (cmd instanceof HeadObjectCommand) {
        return { ContentLength: 8, LastModified: new Date() }
      }
      return {}
    })

    const result = await syncChannelHlsToMinio(root, channelId, slug)
    expect(result.uploaded).toBe(0)
    expect(result.skipped).toBeGreaterThan(0)
    expect(mockSend.mock.calls.every(([cmd]) => !(cmd instanceof PutObjectCommand))).toBe(true)
  })
})

describe('hlsObjectUpToDate', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  it('returns false when object is missing', async () => {
    mockSend.mockRejectedValue(Object.assign(new Error('NotFound'), { name: 'NotFound' }))
    await expect(hlsObjectUpToDate('slug/seg.ts', 100, Date.now())).resolves.toBe(false)
  })

  it('returns true when remote matches local size and mtime', async () => {
    const mtime = Date.now() - 5000
    mockSend.mockResolvedValue({ ContentLength: 100, LastModified: new Date(mtime + 1000) })
    await expect(hlsObjectUpToDate('slug/seg.ts', 100, mtime)).resolves.toBe(true)
  })
})
