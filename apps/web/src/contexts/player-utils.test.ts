// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, afterEach } from 'vitest'
import {
  DEFAULT_LIVE_STREAM_QUALITY,
  HEARTBEAT_INTERVAL_SEC,
  MUTED_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  classifyListenSource,
  qualityLabelForBitrate,
  readStoredMuted,
  readStoredVolume,
} from './player-utils'

describe('qualityLabelForBitrate', () => {
  it('labels the FLAC rendition above the MP3 ceiling', () => {
    expect(qualityLabelForBitrate(400_000)).toBe('FLAC')
    expect(qualityLabelForBitrate(1_411_200)).toBe('FLAC')
  })

  it('labels sub-ceiling bitrates in kbps', () => {
    expect(qualityLabelForBitrate(0)).toBe('0 kbps')
    expect(qualityLabelForBitrate(192_000)).toBe('192 kbps')
    expect(qualityLabelForBitrate(399_999)).toBe('400 kbps')
  })

  it('keeps the live default in sync with the MP3 rendition', () => {
    expect(DEFAULT_LIVE_STREAM_QUALITY).toBe('192 kbps')
  })
})

describe('classifyListenSource', () => {
  it.each([
    [null, 'OTHER'],
    ['/embed/c/slug', 'EMBED'],
    ['/radio', 'TAHTI_RADIO'],
    ['/radio/shows', 'TAHTI_RADIO'],
    ['/c/dj-aurora', 'CHANNEL_PAGE'],
    ['/u/dj-aurora', 'ARTIST_PROFILE'],
    ['/listen', 'DISCOVER'],
    ['/feed', 'DISCOVER'],
    ['/dashboard/channel', 'LIBRARY'],
    ['/', 'OTHER'],
    ['/transparency', 'OTHER'],
  ])('classifies %s as %s', (pathname, expected) => {
    expect(classifyListenSource(pathname)).toBe(expected)
  })
})

describe('stored playback prefs', () => {
  afterEach(() => {
    // @ts-expect-error cleanup test-only global
    delete globalThis.window
  })

  it('falls back to full volume, unmuted without a window', () => {
    expect(readStoredVolume()).toBe(1)
    expect(readStoredMuted()).toBe(false)
  })

  it('clamps stored volume into range and rejects garbage', () => {
    const store: Record<string, string> = { [VOLUME_STORAGE_KEY]: '2', [MUTED_STORAGE_KEY]: '1' }
    // @ts-expect-error test-only window stub
    globalThis.window = { localStorage: { getItem: (k: string) => store[k] ?? null } }
    expect(readStoredVolume()).toBe(1)
    expect(readStoredMuted()).toBe(true)

    store[VOLUME_STORAGE_KEY] = '-0.5'
    expect(readStoredVolume()).toBe(0)

    store[VOLUME_STORAGE_KEY] = 'not-a-number'
    expect(readStoredVolume()).toBe(1)

    expect(HEARTBEAT_INTERVAL_SEC).toBeGreaterThan(0)
    expect(VOLUME_STORAGE_KEY).toBe('tahti-player-volume')
    expect(MUTED_STORAGE_KEY).toBe('tahti-player-muted')
  })
})
