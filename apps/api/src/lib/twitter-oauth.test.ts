// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { generateTwitterPkce } from './twitter-oauth.js'

describe('twitter-oauth PKCE', () => {
  it('generates verifier and S256 challenge', () => {
    const a = generateTwitterPkce()
    const b = generateTwitterPkce()
    expect(a.codeVerifier.length).toBeGreaterThanOrEqual(43)
    expect(a.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.codeVerifier).not.toBe(b.codeVerifier)
  })
})
