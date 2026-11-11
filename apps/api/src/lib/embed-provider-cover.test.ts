// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import {
  bandcampPageUrl,
  lookupEmbedProviderCover,
  mixcloudCloudcastKey,
  spotifyPageUrl,
} from './embed-provider-cover.js'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 404, json: async () => body } as Response
}

function row(
  embedProvider: string | null,
  embedUri: string | null,
  embedSourceUrl: string | null = null,
) {
  return { embedProvider, embedUri, embedSourceUrl }
}

describe('embed provider cover keys', () => {
  it('reads the Mixcloud cloudcast key from a page URL or a bare key', () => {
    expect(mixcloudCloudcastKey(row('MIXCLOUD', 'https://www.mixcloud.com/dj/mix-one'))).toBe(
      '/dj/mix-one/',
    )
    expect(mixcloudCloudcastKey(row('MIXCLOUD', '/dj/mix-one/'))).toBe('/dj/mix-one/')
    expect(mixcloudCloudcastKey(row('MIXCLOUD', 'https://www.mixcloud.com/dj/'))).toBeNull()
  })

  it('builds the Spotify page URL from a spotify: URI or a bare id', () => {
    expect(spotifyPageUrl(row('SPOTIFY', 'spotify:track:4cOdK2wGLETKBW3PvgPWqT'))).toBe(
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    )
    expect(spotifyPageUrl(row('SPOTIFY', '4cOdK2wGLETKBW3PvgPWqT'))).toBe(
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    )
    expect(spotifyPageUrl(row('SPOTIFY', 'not a uri'))).toBeNull()
  })

  it('only treats https bandcamp.com pages as Bandcamp', () => {
    expect(bandcampPageUrl(row('GENERIC', null, 'https://artist.bandcamp.com/track/song'))).toBe(
      'https://artist.bandcamp.com/track/song',
    )
    expect(bandcampPageUrl(row('GENERIC', null, 'https://evilbandcamp.com/track'))).toBeNull()
  })
})

describe('lookupEmbedProviderCover', () => {
  it('returns the largest Mixcloud picture', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        pictures: {
          large: 'https://thumbnailer.mixcloud.com/large.jpg',
          '640wx640h': 'https://thumbnailer.mixcloud.com/640.jpg',
        },
      }),
    )
    await expect(
      lookupEmbedProviderCover(row('MIXCLOUD', 'https://www.mixcloud.com/dj/mix-one/'), {
        fetch: fetchMock,
      }),
    ).resolves.toBe('https://thumbnailer.mixcloud.com/640.jpg')
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.mixcloud.com/dj/mix-one/')
  })

  it('returns the Spotify oEmbed thumbnail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ thumbnail_url: 'https://i.scdn.co/image/abc' }))
    await expect(
      lookupEmbedProviderCover(row('SPOTIFY', 'spotify:track:4cOdK2wGLETKBW3PvgPWqT'), {
        fetch: fetchMock,
      }),
    ).resolves.toBe('https://i.scdn.co/image/abc')
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      encodeURIComponent('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'),
    )
  })

  it('reads og:image from a Bandcamp page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><head><meta property="og:image" content="https://f4.bcbits.com/img/a1_10.jpg"></head></html>',
    } as Response)
    await expect(
      lookupEmbedProviderCover(row('GENERIC', null, 'https://artist.bandcamp.com/track/song'), {
        fetch: fetchMock,
      }),
    ).resolves.toBe('https://f4.bcbits.com/img/a1_10.jpg')
  })

  it('skips Mikseri without a network call', async () => {
    const fetchMock = vi.fn()
    await expect(
      lookupEmbedProviderCover(
        row('MIKSERI', 'https://www.mikseri.net/embed/?type=1&parameter=123'),
        { fetch: fetchMock },
      ),
    ).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when the provider fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(
      lookupEmbedProviderCover(row('MIXCLOUD', '/dj/mix-one/'), { fetch: fetchMock }),
    ).resolves.toBeNull()
    const notFound = vi.fn().mockResolvedValue(jsonResponse({}, false))
    await expect(
      lookupEmbedProviderCover(row('SPOTIFY', 'spotify:track:4cOdK2wGLETKBW3PvgPWqT'), {
        fetch: notFound,
      }),
    ).resolves.toBeNull()
  })
})
