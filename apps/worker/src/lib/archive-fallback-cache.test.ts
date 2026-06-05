// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const { downloadToFile, objectByteSize } = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
  objectByteSize: vi.fn(),
}))

vi.mock('./minio.js', () => ({ downloadToFile, objectByteSize }))

import { syncChannelArchiveFallbackCache } from './archive-fallback-cache.js'

const prismaMock = {
  channel: { findUnique: vi.fn() },
  archiveItem: { findMany: vi.fn() },
}

describe('syncChannelArchiveFallbackCache', () => {
  const root = join(tmpdir(), `tahti-afc-${Date.now()}`)
  const channelId = 'ch-cache'

  beforeEach(async () => {
    vi.clearAllMocks()
    await mkdir(root, { recursive: true })
    prismaMock.channel.findUnique.mockResolvedValue({ fallbackMode: 'shuffle' })
    prismaMock.archiveItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        title: 'Live set',
        mp3Key: 'mp3/artist/item-1.mp3',
        flacKey: null,
        durationSec: 120,
        isFallback: true,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
      },
    ])
    objectByteSize.mockResolvedValue(1000)
    downloadToFile.mockImplementation(async (_key: string, dest: string) => {
      await writeFile(dest, 'x'.repeat(1000))
    })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('downloads pool files and writes local fallback.m3u', async () => {
    const summary = await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 24)

    expect(summary.downloaded).toBe(1)
    const m3u = await stat(join(root, channelId, 'fallback.m3u'))
    expect(m3u.isFile()).toBe(true)
    expect(downloadToFile).toHaveBeenCalledWith(
      'mp3/artist/item-1.mp3',
      join(root, channelId, 'mp3__artist__item-1.mp3'),
    )
  })

  it('skips download when local file matches remote size', async () => {
    const dest = join(root, channelId, 'mp3__artist__item-1.mp3')
    await mkdir(join(root, channelId), { recursive: true })
    await writeFile(dest, 'x'.repeat(1000))

    const summary = await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 24)

    expect(summary.skipped).toBe(1)
    expect(summary.downloaded).toBe(0)
    expect(downloadToFile).not.toHaveBeenCalled()
  })
})
