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

  it('returns the registry JSON array when fetch succeeds', async () => {
    const sample = [{ name: 'Dark cyan', file: 'dark-cyan.css', author: 'tahti' }]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(sample)),
    )
    const res = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ themes: sample })
  })
})
