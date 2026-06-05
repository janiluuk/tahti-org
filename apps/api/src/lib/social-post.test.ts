// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { fillSocialTemplate } from './social-post.js'

describe('social template', () => {
  it('replaces placeholders', () => {
    const out = fillSocialTemplate('Hi {artist} — {smart_link}', {
      artist: 'DJ Test',
      smart_link: 'https://tahti.live/r/demo',
    })
    expect(out).toBe('Hi DJ Test — https://tahti.live/r/demo')
  })
})
