// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('../config.js', () => ({ config: { appUrl: 'https://app.tahti.live' } }))

describe('resolveChannelUrl', () => {
  it('uses the artist wildcard subdomain when the app origin is app.<root>', async () => {
    const { resolveChannelUrl } = await import('./channel-url.js')
    expect(resolveChannelUrl('someartist')).toBe('https://someartist.tahti.live')
  })

  it('appends a hash fragment on the subdomain form', async () => {
    const { resolveChannelUrl } = await import('./channel-url.js')
    expect(resolveChannelUrl('someartist', { hash: 'archive-item-123' })).toBe(
      'https://someartist.tahti.live#archive-item-123',
    )
  })
})

describe('resolveChannelUrl — no app. host', () => {
  it('falls back to the in-app /c/[slug] path (local/dev)', async () => {
    vi.doMock('../config.js', () => ({ config: { appUrl: 'http://localhost:3000' } }))
    vi.resetModules()
    const { resolveChannelUrl } = await import('./channel-url.js')
    expect(resolveChannelUrl('someartist')).toBe('http://localhost:3000/c/someartist')
    expect(resolveChannelUrl('someartist', { hash: 'x' })).toBe(
      'http://localhost:3000/c/someartist#x',
    )
  })
})
