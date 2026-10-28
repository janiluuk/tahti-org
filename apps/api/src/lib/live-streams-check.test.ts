// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@tahti/db'

const send = vi.fn()
vi.mock('./minio.js', () => ({ s3: { send: (...args: unknown[]) => send(...args) } }))

const {
  describeSilentChannels,
  findSilentLiveChannels,
  formatSilentDuration,
  loadLiveChannels,
  newestPlaylistFromMinio,
  probeLiveStreams,
} = await import('./live-streams-check.js')

const NOW = Date.parse('2026-10-28T12:00:00Z')
const opts = { staleMs: 60_000, graceMs: 120_000, now: NOW }

function channel(slug: string, startedAgoMs: number, alwaysOn = false) {
  return { slug, broadcastStartedAt: new Date(NOW - startedAgoMs), alwaysOn }
}

describe('findSilentLiveChannels', () => {
  it('flags stale and missing playlists, ignores fresh and in-grace broadcasts', () => {
    const channels = [
      channel('fresh', 3_600_000),
      channel('stale', 3_600_000, true),
      channel('missing', 3_600_000),
      channel('just-started', 30_000),
    ]
    const newest = new Map<string, number | null>([
      ['fresh', NOW - 5_000],
      ['stale', NOW - 30_660_000],
      ['missing', null],
      ['just-started', null],
    ])
    expect(findSilentLiveChannels(channels, newest, opts)).toEqual([
      { slug: 'stale', alwaysOn: true, silentForMs: 30_660_000 },
      { slug: 'missing', alwaysOn: false, silentForMs: null },
    ])
  })

  it('treats a playlist exactly at the threshold as fresh', () => {
    const newest = new Map([['a', NOW - 60_000]])
    expect(findSilentLiveChannels([channel('a', 3_600_000)], newest, opts)).toEqual([])
  })
})

describe('describeSilentChannels', () => {
  it('lists each silent slug with how long', () => {
    expect(
      describeSilentChannels([
        { slug: 'tahti-radio', alwaysOn: true, silentForMs: 30_660_000 },
        { slug: 'tahti-selects', alwaysOn: true, silentForMs: null },
      ]),
    ).toBe('tahti-radio silent 8h 31m; tahti-selects no playlist')
  })

  it('formats short durations', () => {
    expect(formatSilentDuration(45_000)).toBe('45s')
    expect(formatSilentDuration(125_000)).toBe('2m')
    expect(formatSilentDuration(3_600_000)).toBe('1h 0m')
  })
})

describe('probeLiveStreams', () => {
  it('only looks up channels past the grace period', async () => {
    const lookup = vi.fn(async (slug: string) => (slug === 'old' ? NOW - 600_000 : NOW))
    const result = await probeLiveStreams(
      [channel('old', 3_600_000, true), channel('new', 10_000)],
      lookup,
      opts,
    )
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith('old')
    expect(result).toEqual({
      checked: 1,
      alwaysOnChecked: true,
      silent: [{ slug: 'old', alwaysOn: true, silentForMs: 600_000 }],
    })
  })
})

describe('newestPlaylistFromMinio', () => {
  beforeEach(() => {
    send.mockReset()
  })

  it('returns the newest variant playlist time and ignores missing variants', async () => {
    send.mockImplementation(async (cmd: { input: { Key: string } }) => {
      if (cmd.input.Key === 'ch/stream-mp3-192.m3u8') return { LastModified: new Date(NOW - 9_000) }
      if (cmd.input.Key === 'ch/stream-aac-320.m3u8') return { LastModified: new Date(NOW - 4_000) }
      throw Object.assign(new Error('nf'), { name: 'NotFound' })
    })
    expect(await newestPlaylistFromMinio('hls-live')('ch')).toBe(NOW - 4_000)
    expect(send).not.toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ Key: 'ch/master.m3u8' }) }),
    )
  })

  it('returns null when no variant playlist exists', async () => {
    send.mockRejectedValue(Object.assign(new Error('nf'), { $metadata: { httpStatusCode: 404 } }))
    expect(await newestPlaylistFromMinio('hls-live')('ch')).toBeNull()
  })

  it('rethrows non-404 errors', async () => {
    send.mockRejectedValue(new Error('connection refused'))
    await expect(newestPlaylistFromMinio('hls-live')('ch')).rejects.toThrow('connection refused')
  })
})

describe('loadLiveChannels', () => {
  it('marks Tahti Radio and curated rotation channels as always-on', async () => {
    const startedAt = new Date(NOW - 3_600_000)
    const findMany = vi.fn().mockResolvedValue([
      { slug: 'tahti-radio', broadcasts: [{ startedAt }], curatedRotationItems: [] },
      { slug: 'tahti-selects', broadcasts: [{ startedAt }], curatedRotationItems: [{ id: 'r1' }] },
      { slug: 'artist', broadcasts: [{ startedAt }], curatedRotationItems: [] },
      { slug: 'orphan', broadcasts: [], curatedRotationItems: [] },
    ])
    const prisma = { channel: { findMany } } as unknown as PrismaClient
    expect(await loadLiveChannels(prisma)).toEqual([
      { slug: 'tahti-radio', broadcastStartedAt: startedAt, alwaysOn: true },
      { slug: 'tahti-selects', broadcastStartedAt: startedAt, alwaysOn: true },
      { slug: 'artist', broadcastStartedAt: startedAt, alwaysOn: false },
    ])
  })
})
