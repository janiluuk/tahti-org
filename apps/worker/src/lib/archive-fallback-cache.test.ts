// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, writeFile, stat, readFile } from 'node:fs/promises'
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
    prismaMock.channel.findUnique.mockResolvedValue({
      fallbackMode: 'shuffle',
      fallbackEnabled: true,
    })
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

  it('prunes cached files removed from the rotation pool', async () => {
    const channelDir = join(root, channelId)
    await mkdir(channelDir, { recursive: true })
    await writeFile(join(channelDir, 'stale.mp3'), 'old')
    await writeFile(join(channelDir, 'fallback.m3u'), '#EXTM3U\n')

    const summary = await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 24)

    expect(summary.pruned).toBe(1)
    await expect(stat(join(channelDir, 'stale.mp3'))).rejects.toThrow()
  })

  it('respects maxItems when building the cache pool', async () => {
    prismaMock.archiveItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        title: 'First',
        mp3Key: 'mp3/a1.mp3',
        flacKey: null,
        durationSec: 60,
        isFallback: true,
        fallbackOrder: 0,
        lastFallbackPlayedAt: null,
      },
      {
        id: 'item-2',
        title: 'Second',
        mp3Key: 'mp3/a2.mp3',
        flacKey: null,
        durationSec: 60,
        isFallback: true,
        fallbackOrder: 1,
        lastFallbackPlayedAt: null,
      },
    ])

    await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 1)

    expect(downloadToFile).toHaveBeenCalledTimes(1)
    expect(downloadToFile).toHaveBeenCalledWith('mp3/a1.mp3', join(root, channelId, 'mp3__a1.mp3'))
  })

  it('writes m3u entries pointing at local cache paths', async () => {
    await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 24)

    const m3u = await readFile(join(root, channelId, 'fallback.m3u'), 'utf8')
    expect(m3u).toContain('#EXTINF:120,Live set')
    expect(m3u).toContain(`${join(root, channelId)}/mp3__artist__item-1.mp3`)
  })

  it('returns zero counts when channel is missing', async () => {
    prismaMock.channel.findUnique.mockResolvedValue(null)

    const summary = await syncChannelArchiveFallbackCache(prismaMock as never, 'missing', root, 24)

    expect(summary).toEqual({ downloaded: 0, skipped: 0, pruned: 0 })
    expect(downloadToFile).not.toHaveBeenCalled()
  })

  it('M33: skips the pool entirely and writes an empty m3u when fallbackEnabled is false', async () => {
    prismaMock.channel.findUnique.mockResolvedValue({
      fallbackMode: 'shuffle',
      fallbackEnabled: false,
    })

    const summary = await syncChannelArchiveFallbackCache(prismaMock as never, channelId, root, 24)

    expect(summary.downloaded).toBe(0)
    expect(downloadToFile).not.toHaveBeenCalled()
    const m3u = await readFile(join(root, channelId, 'fallback.m3u'), 'utf8')
    expect(m3u).toContain('no items yet')
  })
})
