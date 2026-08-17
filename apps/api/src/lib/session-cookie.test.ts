// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { sessionCookieCandidates } from './session-cookie.js'

describe('sessionCookieCandidates', () => {
  it('keeps both host-only and parent-domain sessions for validation', () => {
    expect(
      sessionCookieCandidates(
        'theme=dark; tahti_session=stale; tahti_session=current',
        'tahti_session',
      ),
    ).toEqual(['stale', 'current'])
  })

  it('deduplicates the cookie parser fallback', () => {
    expect(sessionCookieCandidates('tahti_session=current', 'tahti_session', 'current')).toEqual([
      'current',
    ])
  })
})
