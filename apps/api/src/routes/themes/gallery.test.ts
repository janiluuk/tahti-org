// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { getRedisClient } from '../../lib/redis.js'

describe('GET /api/v1/themes/gallery', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  beforeEach(async () => {
    vi.unstubAllGlobals()
    const redis = await getRedisClient()
    await redis?.del('themes:gallery')
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await app.close()
  })

  it('returns themes: [] when the registry fetch is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not Found', { status: 404 })),
    )
    const res = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ themes: [] })
  })

  it('maps the tahti-registry catalog to gallery entries', async () => {
    const catalog = {
      version: 1,
      themes: [
        {
          id: 'dark-cyan',
          name: 'Dark cyan',
          description: 'A dark theme with cyan accents.',
          author: 'tahti',
          tags: ['dark'],
          palette: ['black', 'rgb(17 17 17)', 'cyan', 'white'],
          path: 'themes/dark-cyan.json',
        },
        { id: 'no-path', name: 'Broken row' },
      ],
    }
    const fetchMock = vi.fn(async () => Response.json(catalog))
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      themes: [
        {
          id: 'dark-cyan',
          name: 'Dark cyan',
          file: 'themes/dark-cyan.json',
          author: 'tahti',
          description: 'A dark theme with cyan accents.',
          tags: ['dark'],
          palette: ['black', 'rgb(17 17 17)', 'cyan', 'white'],
        },
      ],
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'janiluuk/tahti-registry/master/themes.json',
    )
  })

  it('returns themes: [] when the catalog is not the expected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json([{ name: 'Old', file: 'old.css' }])),
    )
    const res = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ themes: [] })
  })
})
