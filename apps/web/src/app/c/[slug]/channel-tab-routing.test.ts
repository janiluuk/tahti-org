// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { channelTabForHash } from './channel-tab-routing'

describe('channelTabForHash', () => {
  it('opens the archive for archive item deep-links', () => {
    expect(channelTabForHash('#archive-item-track-123')).toBe('archive')
  })

  it('leaves unrelated hashes alone', () => {
    expect(channelTabForHash('#live-player')).toBeNull()
  })
})
