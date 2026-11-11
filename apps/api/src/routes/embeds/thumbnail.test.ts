// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { clearEmbedThumbnailCache } from '../../lib/embed-thumbnail.js'

describe('GET /api/v1/embeds/thumbnail', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearEmbedThumbnailCache()
  })

  afterAll(async () => {
    await app.close()
  })

  const get = (url: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/embeds/thumbnail?url=${encodeURIComponent(url)}`,
    })

  it('answers the provider thumbnail without a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ thumbnail_url: 'https://i1.sndcdn.com/cover.jpg' }),
      }),
    )
    const res = await get('https://soundcloud.com/artist/track')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ thumbnailUrl: 'https://i1.sndcdn.com/cover.jpg' })
    expect(res.headers['cache-control']).toBe('public, max-age=86400')
  })

  it('answers null when the provider has no thumbnail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const res = await get('https://soundcloud.com/artist/gone')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ thumbnailUrl: null })
    expect(res.headers['cache-control']).toBe('public, max-age=3600')
  })

  it('rejects other hosts, plain http and a missing url', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await get('https://example.com/a')).statusCode).toBe(400)
    expect((await get('http://soundcloud.com/a/b')).statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: '/api/v1/embeds/thumbnail' })).statusCode).toBe(
      400,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
