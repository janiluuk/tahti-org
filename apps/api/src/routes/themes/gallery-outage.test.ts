// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Redis is off in tests, so stand in a plain map for the JSON cache to see
// what the route would have cached.
const cache = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../../lib/json-cache.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/json-cache.js')>()),
  getCachedJson: async (key: string, _ttl: number, compute: () => Promise<unknown>) => {
    if (cache.has(key)) return cache.get(key)
    const value = await compute()
    cache.set(key, value)
    return value
  },
}))

const { buildApp } = await import('../../server.js')

describe('theme gallery during a registry outage', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await app.close()
  })

  it('does not cache an empty gallery when the registry is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad Gateway', { status: 502 })),
    )
    const down = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(down.json()).toEqual({ themes: [] })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ themes: [{ id: 'night', name: 'Night', path: 'themes/night.json' }] }),
      ),
    )
    const back = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(back.json().themes).toEqual([{ id: 'night', name: 'Night', file: 'themes/night.json' }])
  })

  it('gives up on a registry that does not answer', async () => {
    cache.clear()
    let signal: AbortSignal | null | undefined
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      signal = init?.signal
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.inject({ method: 'GET', url: '/api/v1/themes/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ themes: [] })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(signal).toBeInstanceOf(AbortSignal)
  })
})
