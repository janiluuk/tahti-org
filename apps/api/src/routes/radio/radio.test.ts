// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'

describe('M16 — Tahti Radio proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
  })

  it('proxies now-playing from the radio service', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            live: true,
            channel: { slug: 'radio-artist', displayName: 'On Air' },
          }),
          { status: 200 },
        ),
      ),
    )

    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json().live).toBe(true)
    expect(res.json().channel.slug).toBe('radio-artist')
  })

  it('returns offline state when radio service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ live: false, channel: null })
  })
})
