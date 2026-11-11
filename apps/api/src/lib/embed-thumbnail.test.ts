// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearEmbedThumbnailCache,
  isSupportedEmbedPage,
  lookupEmbedThumbnail,
} from './embed-thumbnail.js'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 404, json: async () => body } as Response
}

describe('embed thumbnail lookup', () => {
  beforeEach(() => clearEmbedThumbnailCache())

  it('accepts only https pages on known providers', () => {
    expect(isSupportedEmbedPage('https://soundcloud.com/a/b')).toBe(true)
    expect(isSupportedEmbedPage('https://www.mixcloud.com/dj/mix/')).toBe(true)
    expect(isSupportedEmbedPage('https://artist.bandcamp.com/track/x')).toBe(true)
    expect(isSupportedEmbedPage('https://hearthis.at/dj/set/')).toBe(true)
    expect(isSupportedEmbedPage('http://soundcloud.com/a/b')).toBe(false)
    expect(isSupportedEmbedPage('https://example.com/a')).toBe(false)
    expect(isSupportedEmbedPage('https://soundcloud.com.evil.test/a')).toBe(false)
    expect(isSupportedEmbedPage('not a url')).toBe(false)
  })

  it('reads SoundCloud oEmbed and caches the answer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ thumbnail_url: 'https://i1.sndcdn.com/a.jpg' }))
    const first = await lookupEmbedThumbnail('https://soundcloud.com/a/b#t=1', {
      fetch: fetchMock,
    })
    const second = await lookupEmbedThumbnail('https://soundcloud.com/a/b', { fetch: fetchMock })
    expect(first).toBe('https://i1.sndcdn.com/a.jpg')
    expect(second).toBe('https://i1.sndcdn.com/a.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent('https://soundcloud.com/a/b')}`,
    )
  })

  it('drops non-https thumbnails and failed lookups', async () => {
    const insecure = vi
      .fn()
      .mockResolvedValue(jsonResponse({ thumbnail_url: 'http://i1.sndcdn.com/a.jpg' }))
    expect(await lookupEmbedThumbnail('https://soundcloud.com/x/y', { fetch: insecure })).toBe(null)
    const offline = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await lookupEmbedThumbnail('https://soundcloud.com/x/z', { fetch: offline })).toBe(null)
  })

  it('uses the Mixcloud API for Mixcloud pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ pictures: { '640wx640h': 'https://thumbnailer.mixcloud.com/640.jpg' } }),
      )
    const thumb = await lookupEmbedThumbnail('https://www.mixcloud.com/dj/mix-one/', {
      fetch: fetchMock,
    })
    expect(thumb).toBe('https://thumbnailer.mixcloud.com/640.jpg')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.mixcloud.com/dj/mix-one/')
  })

  it('never fetches an unsupported host', async () => {
    const fetchMock = vi.fn()
    expect(await lookupEmbedThumbnail('https://example.com/a', { fetch: fetchMock })).toBe(null)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
