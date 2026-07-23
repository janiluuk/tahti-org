// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveAppUrl, resolveChannelUrl } from './app-url'

describe('resolveChannelUrl', () => {
  const originalNextPublic = process.env.NEXT_PUBLIC_APP_URL
  const originalApp = process.env.APP_URL

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.APP_URL
  })

  afterEach(() => {
    if (originalNextPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalNextPublic
    if (originalApp === undefined) delete process.env.APP_URL
    else process.env.APP_URL = originalApp
  })

  it('uses the artist wildcard subdomain when the app origin is app.<root>', () => {
    expect(resolveAppUrl()).toBe('https://app.tahti.live')
    expect(resolveChannelUrl('someartist')).toBe('https://someartist.tahti.live')
  })

  it('falls back to the in-app /c/[slug] path when there is no app. host (local/dev)', () => {
    process.env.APP_URL = 'http://localhost:17777'
    expect(resolveChannelUrl('someartist')).toBe('http://localhost:17777/c/someartist')
  })

  it('respects an overridden NEXT_PUBLIC_APP_URL with an app. host', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.staging.tahti.live'
    expect(resolveChannelUrl('someartist')).toBe('https://someartist.staging.tahti.live')
  })

  it('appends a hash fragment on the subdomain form', () => {
    expect(resolveChannelUrl('someartist', { hash: 'archive-item-123' })).toBe(
      'https://someartist.tahti.live#archive-item-123',
    )
  })

  it('appends a hash fragment on the path fallback form', () => {
    process.env.APP_URL = 'http://localhost:17777'
    expect(resolveChannelUrl('someartist', { hash: 'archive-item-123' })).toBe(
      'http://localhost:17777/c/someartist#archive-item-123',
    )
  })
})
