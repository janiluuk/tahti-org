// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { liveShowEpisodeTitle } from './channel-schedule.js'

describe('liveShowEpisodeTitle', () => {
  it('adds the reserved episode number when numbering is enabled', () => {
    expect(liveShowEpisodeTitle('Midnight Signals', 12)).toBe('Midnight Signals #12')
  })

  it('uses the series name unchanged when numbering is disabled', () => {
    expect(liveShowEpisodeTitle('Sunday Session', null)).toBe('Sunday Session')
  })
})
