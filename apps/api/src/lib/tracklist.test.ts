// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { formatTracklistTimestamp } from './tracklist.js'

describe('formatTracklistTimestamp', () => {
  it('formats under one hour as m:ss', () => {
    expect(formatTracklistTimestamp(125)).toBe('2:05')
  })

  it('formats hours as h:mm:ss', () => {
    expect(formatTracklistTimestamp(3661)).toBe('1:01:01')
  })
})
