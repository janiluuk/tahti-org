// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { actorDisplayName } from '@tahti/db/display-name'
import { safeDisplayName } from './display-name.js'

describe('actorDisplayName in @tahti/db', () => {
  it.each([
    'Yaniho',
    '  Yaniho ',
    '',
    '   ',
    'janiluuk@gmail.com',
    'DJ x@y.fi',
    'Mail me: someone@example.org!',
    'at @handle',
    'name@localhost',
    'A.B@C.D',
  ])('agrees with safeDisplayName for %j', (candidate) => {
    expect(actorDisplayName({ username: 'fallback', displayName: candidate })).toBe(
      safeDisplayName(candidate, 'fallback'),
    )
  })
})
