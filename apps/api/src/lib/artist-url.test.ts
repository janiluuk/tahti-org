// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('../config.js', () => ({ config: { appUrl: 'https://app.tahti.live' } }))

describe('resolveArtistUrl / resolveLinkPageUrl', () => {
  it('full site is the artist subdomain; link page is apex /u/', async () => {
    const { resolveArtistUrl, resolveLinkPageUrl } = await import('./artist-url.js')
    expect(resolveArtistUrl('yaniho')).toBe('https://yaniho.tahti.live')
    expect(resolveLinkPageUrl('yaniho')).toBe('https://tahti.live/u/yaniho')
  })
})

describe('resolveArtistUrl — apex APP_URL', () => {
  it('still uses the wildcard subdomain for the full site', async () => {
    vi.doMock('../config.js', () => ({ config: { appUrl: 'https://tahti.live' } }))
    vi.resetModules()
    const { resolveArtistUrl, resolveLinkPageUrl } = await import('./artist-url.js')
    expect(resolveArtistUrl('yaniho')).toBe('https://yaniho.tahti.live')
    expect(resolveLinkPageUrl('yaniho')).toBe('https://tahti.live/u/yaniho')
  })
})

describe('resolveArtistUrl — local/dev', () => {
  it('falls back to /u/ for both helpers without wildcard DNS', async () => {
    vi.doMock('../config.js', () => ({
      config: { appUrl: 'http://localhost:3000' },
    }))
    vi.resetModules()
    const { resolveArtistUrl, resolveLinkPageUrl } = await import('./artist-url.js')
    expect(resolveArtistUrl('yaniho')).toBe('http://localhost:3000/u/yaniho')
    expect(resolveLinkPageUrl('yaniho')).toBe('http://localhost:3000/u/yaniho')
  })
})
