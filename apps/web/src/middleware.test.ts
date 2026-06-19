// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }))
}

describe('PLAT-050/051 — subdomain + custom domain routing middleware', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.API_URL = 'http://api:3001'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fast path: rewrites slug.tahti.live to /c/[slug]', async () => {
    const res = await middleware(
      req('https://someartist.tahti.live/', {
        'x-tahti-channel-slug': 'someartist',
      }),
    )
    expect(res.headers.get('x-middleware-rewrite')).toContain('/c/someartist')
  })

  it('fast path: does not double-rewrite when already on /c/[slug]', async () => {
    const res = await middleware(
      req('https://someartist.tahti.live/c/someartist', {
        'x-tahti-channel-slug': 'someartist',
      }),
    )
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('slow path: resolves custom host via API and rewrites to /c/[slug]', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ slug: 'cd-paid-artist' }),
    }) as unknown as typeof fetch

    const res = await middleware(
      req('https://artist-example.com/', {
        'x-tahti-custom-host': 'artist-example.com',
      }),
    )

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/custom-domain/resolve?host=artist-example.com'),
      expect.objectContaining({ cache: 'no-store' }),
    )
    expect(res.headers.get('x-middleware-rewrite')).toContain('/c/cd-paid-artist')
  })

  it('slow path: falls through (no rewrite) when API returns 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const res = await middleware(
      req('https://unknown-domain.com/', {
        'x-tahti-custom-host': 'unknown-domain.com',
      }),
    )

    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('slow path: falls through (no rewrite) when API is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch

    const res = await middleware(
      req('https://unknown-domain.com/', {
        'x-tahti-custom-host': 'unknown-domain.com',
      }),
    )

    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('passes through untouched when neither header is present', async () => {
    const res = await middleware(req('https://app.tahti.live/dashboard'))
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })
})
