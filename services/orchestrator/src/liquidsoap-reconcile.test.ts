// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { channelSlugFromContainerName } from './liquidsoap.js'

describe('channelSlugFromContainerName', () => {
  it('strips the tahti-channel- prefix', () => {
    expect(channelSlugFromContainerName('tahti-channel-tahti-selects')).toBe('tahti-selects')
    expect(channelSlugFromContainerName('tahti-channel-tahti-radio')).toBe('tahti-radio')
  })

  it('returns null for unrelated container names', () => {
    expect(channelSlugFromContainerName('tahti-api')).toBeNull()
    expect(channelSlugFromContainerName('tahti-channel-')).toBeNull()
    expect(channelSlugFromContainerName('')).toBeNull()
  })
})
