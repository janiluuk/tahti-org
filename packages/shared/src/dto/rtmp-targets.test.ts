// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { CreateRtmpTargetSchema, PatchRtmpTargetSchema } from './rtmp-targets.js'

describe('RTMP target DTOs', () => {
  it('accepts create payload with provider normalization', () => {
    const parsed = CreateRtmpTargetSchema.safeParse({
      provider: 'youtube',
      label: 'YT Live',
      streamKey: 'secret',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.provider).toBe('YOUTUBE')
  })

  it('rejects missing label', () => {
    expect(
      CreateRtmpTargetSchema.safeParse({ provider: 'TWITCH', label: '  ', streamKey: 'x' }).success,
    ).toBe(false)
  })

  it('accepts patch toggles', () => {
    expect(PatchRtmpTargetSchema.safeParse({ enabled: false }).success).toBe(true)
  })
})
