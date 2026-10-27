// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { UpsertInternetRadioPresetSchema } from './internet-radio.js'

describe('UpsertInternetRadioPresetSchema', () => {
  it('accepts an HTTPS stream URL', () => {
    const parsed = UpsertInternetRadioPresetSchema.safeParse({
      name: 'Station',
      streamUrl: ' https://stream.example.com/live.mp3 ',
    })
    expect(parsed.success && parsed.data.streamUrl).toBe('https://stream.example.com/live.mp3')
  })

  it('rejects an http:// stream URL, which the HTTPS web player cannot load', () => {
    const parsed = UpsertInternetRadioPresetSchema.safeParse({
      name: 'Station',
      streamUrl: 'http://stream.example.com/live.mp3',
    })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe('Stream URL must start with https://')
  })

  it('rejects a value that is not a URL', () => {
    const parsed = UpsertInternetRadioPresetSchema.safeParse({
      name: 'Station',
      streamUrl: 'not a url',
    })
    expect(parsed.success).toBe(false)
  })
})
