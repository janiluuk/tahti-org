// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  orderFallbackPool,
  selectFallbackPool,
  localCacheBasename,
  playbackKeyFromLocalCacheBasename,
  renderLocalFallbackM3u,
  buildFallbackPlaybackRows,
  renderFallbackM3u,
  channelArchiveCacheDir,
  interleaveAnnouncements,
  type AnnouncementPlaybackRow,
  type FallbackPlaybackRow,
} from './fallback-playlist.js'

const base = {
  mp3Key: 'mp3/a.mp3',
  flacKey: null as string | null,
  durationSec: 100,
  createdAt: new Date('2026-01-01'),
}

describe('fallback-playlist', () => {
  it('uses isFallback subset when any item is flagged', () => {
    const pool = selectFallbackPool([
      {
        id: 'a',
        title: 'A',
        isFallback: true,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
      {
        id: 'b',
        title: 'B',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
    ])
    expect(pool.map((i) => i.id)).toEqual(['a'])
  })

  it('falls back to all playable items when none flagged', () => {
    const pool = selectFallbackPool([
      {
        id: 'a',
        title: 'A',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
      {
        id: 'b',
        title: 'B',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
    ])
    expect(pool).toHaveLength(2)
  })

  it('orders by fallbackOrder in ordered mode', () => {
    const ordered = orderFallbackPool(
      [
        {
          id: 'late',
          title: 'Late',
          isFallback: true,
          fallbackOrder: 2,
          lastFallbackPlayedAt: null,
          ...base,
        },
        {
          id: 'first',
          title: 'First',
          isFallback: true,
          fallbackOrder: 0,
          lastFallbackPlayedAt: null,
          ...base,
        },
      ],
      'ordered',
    )
    expect(ordered.map((i) => i.id)).toEqual(['first', 'late'])
  })

  it('sorts shuffle by oldest lastFallbackPlayedAt first', () => {
    const ordered = orderFallbackPool(
      [
        {
          id: 'recent',
          title: 'Recent',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: new Date('2026-06-01'),
          ...base,
        },
        {
          id: 'stale',
          title: 'Stale',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: new Date('2026-01-01'),
          ...base,
        },
        {
          id: 'never',
          title: 'Never',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: null,
          ...base,
        },
      ],
      'shuffle',
    )
    expect(ordered.map((i) => i.id)).toEqual(['never', 'stale', 'recent'])
  })
})

describe('renderLocalFallbackM3u', () => {
  it('emits absolute paths under the channel cache dir', () => {
    const body = renderLocalFallbackM3u(
      [{ id: '1', title: 'Set A', playbackKey: 'mp3/artist/a.mp3', durationSec: 3600 }],
      '/archive-cache/ch-1',
    )
    expect(body).toContain('#EXTINF:3600,Set A')
    expect(body).toContain('/archive-cache/ch-1/mp3__artist__a.mp3')
  })

  it('sanitizes nested playback keys', () => {
    expect(localCacheBasename('flac/slug/item.flac')).toBe('flac__slug__item.flac')
    expect(playbackKeyFromLocalCacheBasename('flac__slug__item.flac')).toBe('flac/slug/item.flac')
    expect(playbackKeyFromLocalCacheBasename('mp3__tahti-selects__abc.mp3')).toBe(
      'mp3/tahti-selects/abc.mp3',
    )
    expect(playbackKeyFromLocalCacheBasename('liq-process.tmp')).toBeNull()
  })

  it('returns empty playlist marker when pool is empty', () => {
    expect(renderLocalFallbackM3u([], '/archive-cache/ch-1')).toContain('# no items yet')
  })
})

describe('buildFallbackPlaybackRows', () => {
  it('drops items without a playback key', () => {
    const rows = buildFallbackPlaybackRows(
      [
        {
          id: 'a',
          title: 'Ready',
          mp3Key: 'mp3/a.mp3',
          flacKey: null,
          durationSec: 100,
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: null,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'b',
          title: 'Processing',
          mp3Key: null,
          flacKey: null,
          durationSec: null,
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: null,
          createdAt: new Date('2026-01-01'),
        },
      ],
      'ordered',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.playbackKey).toBe('mp3/a.mp3')
  })
})

describe('renderFallbackM3u', () => {
  it('emits the caller-supplied URL for remote Liquidsoap fallback', () => {
    const body = renderFallbackM3u([
      { title: 'Set A', durationSec: 90, url: 'https://cdn.tahti.live/tahti/mp3/a.mp3?sig=abc' },
    ])
    expect(body).toContain('#EXTINF:90,Set A')
    expect(body).toContain('https://cdn.tahti.live/tahti/mp3/a.mp3?sig=abc')
  })

  it('returns empty playlist marker when pool is empty', () => {
    expect(renderFallbackM3u([])).toContain('# no items yet')
  })
})

describe('channelArchiveCacheDir', () => {
  it('joins root and channel id without trailing slash on root', () => {
    expect(channelArchiveCacheDir('/archive-cache/', 'ch-1')).toBe('/archive-cache/ch-1')
  })
})

describe('interleaveAnnouncements', () => {
  const track = (id: string): FallbackPlaybackRow => ({
    id,
    title: id,
    playbackKey: `mp3/${id}.mp3`,
    durationSec: 100,
  })
  const announcement = (
    id: string,
    scheduleMode: AnnouncementPlaybackRow['scheduleMode'],
    everyNth: number | null = null,
  ): AnnouncementPlaybackRow => ({
    id,
    title: id,
    playbackKey: `mp3/${id}.mp3`,
    durationSec: 10,
    scheduleMode,
    everyNth,
  })

  it('is a no-op with no announcements at all', () => {
    const rows = [track('a'), track('b')]
    expect(interleaveAnnouncements(rows, [], [])).toEqual(rows)
  })

  it('is a no-op on an empty track list even with announcements configured', () => {
    expect(interleaveAnnouncements([], [announcement('sys1', 'AFTER_EVERY')], [])).toEqual([])
  })

  it('does nothing for the system half when there are no system announcements, even with own clips', () => {
    const rows = [track('a'), track('b'), track('c')]
    const result = interleaveAnnouncements(rows, [], [track('own1')])
    // own clips are probabilistic, but no 'sys' ids should ever appear
    expect(result.some((r) => r.id.startsWith('sys'))).toBe(false)
  })

  it('inserts an AFTER_EVERY clip after every single track', () => {
    const rows = [track('a'), track('b'), track('c')]
    const result = interleaveAnnouncements(rows, [announcement('sys1', 'AFTER_EVERY')], [])
    expect(result.map((r) => r.id)).toEqual(['a', 'sys1', 'b', 'sys1', 'c', 'sys1'])
  })

  it('inserts an EVERY_NTH clip only at multiples of N', () => {
    const rows = [track('a'), track('b'), track('c'), track('d')]
    const result = interleaveAnnouncements(rows, [announcement('sys1', 'EVERY_NTH', 2)], [])
    expect(result.map((r) => r.id)).toEqual(['a', 'b', 'sys1', 'c', 'd', 'sys1'])
  })

  it('combines multiple system schedules at the same boundary', () => {
    const rows = [track('a'), track('b')]
    const result = interleaveAnnouncements(
      rows,
      [announcement('always', 'AFTER_EVERY'), announcement('every2', 'EVERY_NTH', 2)],
      [],
    )
    expect(result.map((r) => r.id)).toEqual(['a', 'always', 'b', 'always', 'every2'])
  })
})
