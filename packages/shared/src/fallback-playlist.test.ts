// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  orderFallbackPool,
  selectFallbackPool,
  localCacheBasename,
  renderLocalFallbackM3u,
  buildFallbackPlaybackRows,
  renderFallbackM3u,
  channelArchiveCacheDir,
} from './fallback-playlist.js'

const base = {
  mp3Key: 'mp3/a.mp3',
  flacKey: null as string | null,
  durationSec: 100,
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
        },
      ],
      'ordered',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.playbackKey).toBe('mp3/a.mp3')
  })
})

describe('renderFallbackM3u', () => {
  it('builds MinIO URLs for remote Liquidsoap fallback', () => {
    const body = renderFallbackM3u(
      [{ id: '1', title: 'Set A', playbackKey: 'mp3/a.mp3', durationSec: 90 }],
      'http://minio:9000',
      'tahti',
    )
    expect(body).toContain('#EXTINF:90,Set A')
    expect(body).toContain('http://minio:9000/tahti/mp3/a.mp3')
  })
})

describe('channelArchiveCacheDir', () => {
  it('joins root and channel id without trailing slash on root', () => {
    expect(channelArchiveCacheDir('/archive-cache/', 'ch-1')).toBe('/archive-cache/ch-1')
  })
})
