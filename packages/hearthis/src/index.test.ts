// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { createHearthisClient, parseHearthisUsername } from './index.js'

const SAMPLE_TRACK = {
  id: '14624101',
  title: 'Credo',
  permalink: 'credo',
  permalink_url: 'https://hearthis.at/candana-dj/credo/',
  uri: 'https://api-v2.hearthis.at/candana-dj/credo/',
  duration: '4015',
  genre: 'Techno',
  downloadable: '1',
  created_at: '2026-08-12 12:18:43',
  release_date: '2026-08-12 12:18:43',
  artwork_url: 'https://img.hearthis.at/artwork.jpg',
  user: {
    id: '10464002',
    permalink: 'candana-dj',
    username: 'Carlos Andana',
    uri: 'https://api-v2.hearthis.at/candana-dj/',
    permalink_url: 'https://hearthis.at/candana-dj/',
  },
  stream_url: 'https://hearthis.app/candana-dj/credo/listen/?s=XPS',
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

describe('@tahti/hearthis client', () => {
  it('lists categories with different data (array of category objects)', async () => {
    const fetchMock = mockFetch(200, [
      { id: 'techno', name: 'Techno', url: 'https://hearthis.at/categories/techno/', api_url: 'x' },
    ])
    const client = createHearthisClient({ fetch: fetchMock })
    const categories = await client.listCategories()
    expect(categories).toHaveLength(1)
    expect(categories[0]?.name).toBe('Techno')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/categories/'))
  })

  it('fetches the feed with query params forwarded', async () => {
    const fetchMock = mockFetch(200, [SAMPLE_TRACK])
    const client = createHearthisClient({ fetch: fetchMock })
    const tracks = await client.getFeed({ count: 5, type: 'popular', category: 'techno' })
    expect(tracks[0]?.title).toBe('Credo')
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('/feed/')
    expect(calledUrl).toContain('count=5')
    expect(calledUrl).toContain('type=popular')
    expect(calledUrl).toContain('category=techno')
  })

  it('fetches a user profile (single object, not an array)', async () => {
    const fetchMock = mockFetch(200, {
      id: '10464002',
      permalink: 'candana-dj',
      username: 'Carlos Andana',
      uri: 'x',
      permalink_url: 'https://hearthis.at/candana-dj/',
      track_count: '55',
    })
    const client = createHearthisClient({ fetch: fetchMock })
    const user = await client.getUser('candana-dj')
    expect(user.track_count).toBe('55')
  })

  it('fetches a single track by user+track permalink', async () => {
    const fetchMock = mockFetch(200, SAMPLE_TRACK)
    const client = createHearthisClient({ fetch: fetchMock })
    const track = await client.getTrack('candana-dj', 'credo')
    expect(track.id).toBe('14624101')
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain('/candana-dj/credo/')
  })

  it('resolves a pasted hearthis.at track URL end to end', async () => {
    const fetchMock = mockFetch(200, SAMPLE_TRACK)
    const client = createHearthisClient({ fetch: fetchMock })
    const track = await client.getTrackByUrl('https://hearthis.at/candana-dj/credo/')
    expect(track.permalink).toBe('credo')
  })

  it('rejects a URL from a different host', async () => {
    const client = createHearthisClient({ fetch: mockFetch(200, SAMPLE_TRACK) })
    await expect(client.getTrackByUrl('https://soundcloud.com/foo/bar')).rejects.toThrow(
      /Not a hearthis\.at track URL/,
    )
  })

  it('searches tracks and forwards the query', async () => {
    const fetchMock = mockFetch(200, [SAMPLE_TRACK])
    const client = createHearthisClient({ fetch: fetchMock })
    const results = await client.search('techno', { count: 10 })
    expect(results).toHaveLength(1)
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('/search/')
    expect(calledUrl).toContain('q=techno')
    expect(calledUrl).toContain('type=track')
  })

  it('lists a user\'s tracks (empty array — different data shape than a populated one)', async () => {
    const fetchMock = mockFetch(200, [])
    const client = createHearthisClient({ fetch: fetchMock })
    const tracks = await client.getUserTracks('nobody-yet')
    expect(tracks).toEqual([])
  })

  it('lists a user\'s tracks via ?type=tracks on the profile path, not /tracks/', async () => {
    // Regression test: /{permalink}/tracks/ 404s live as {"status":"error","message":"Content Gone"} —
    // confirmed against hearthis.at/yaniho. The real listing is /{permalink}/?type=tracks.
    const fetchMock = mockFetch(200, [SAMPLE_TRACK])
    const client = createHearthisClient({ fetch: fetchMock })
    await client.getUserTracks('yaniho', { count: 5 })
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toMatch(/\/yaniho\/\?.*type=tracks/)
    expect(calledUrl).not.toContain('/yaniho/tracks/')
    expect(calledUrl).toContain('count=5')
  })

  it('throws on a 200 response carrying {status:"error"} (a gone/unresolvable permalink)', async () => {
    const fetchMock = mockFetch(200, { status: 'error', message: 'Content Gone' })
    const client = createHearthisClient({ fetch: fetchMock })
    await expect(client.getUserTracks('some-old-handle')).rejects.toThrow(/Content Gone/)
  })

  it('sends key/secret when configured', async () => {
    const fetchMock = mockFetch(200, [])
    const client = createHearthisClient({ fetch: fetchMock, apiKey: 'k', apiSecret: 's' })
    await client.listCategories()
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('key=k')
    expect(calledUrl).toContain('secret=s')
  })

  it('throws on a non-ok HTTP response', async () => {
    const fetchMock = mockFetch(404, { success: false, message: 'not found' })
    const client = createHearthisClient({ fetch: fetchMock })
    await expect(client.getUser('nobody')).rejects.toThrow(/failed \(404\)/)
  })

  it('throws on a 200 response carrying {success:false} (rate limit, etc.)', async () => {
    const fetchMock = mockFetch(200, { success: false, message: 'limit reached' })
    const client = createHearthisClient({ fetch: fetchMock })
    await expect(client.search('x')).rejects.toThrow(/limit reached/)
  })
})

describe('parseHearthisUsername', () => {
  it('extracts the handle from a profile URL', () => {
    expect(parseHearthisUsername('https://hearthis.at/candana-dj/')).toBe('candana-dj')
  })

  it('accepts a bare handle', () => {
    expect(parseHearthisUsername('candana-dj')).toBe('candana-dj')
  })

  it('rejects a non-hearthis.at URL', () => {
    expect(parseHearthisUsername('https://soundcloud.com/candana-dj/')).toBeNull()
  })

  it('rejects empty input', () => {
    expect(parseHearthisUsername('')).toBeNull()
  })
})
