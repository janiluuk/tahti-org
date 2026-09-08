// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { __testOnly } from './use-centrifugo-chat'

const { parseInboundPush } = __testOnly

describe('parseInboundPush', () => {
  it('returns null for missing text', () => {
    expect(parseInboundPush({ handle: 'a' })).toBeNull()
    expect(parseInboundPush(null)).toBeNull()
  })

  it('maps a full push payload', () => {
    const msg = parseInboundPush({
      handle: 'dj',
      text: 'hello',
      ts: 100,
      supporter: true,
      channelRole: 'owner',
      countryCode: 'FI',
      system: false,
      href: '/u/dj',
    })
    expect(msg).toMatchObject({
      handle: 'dj',
      text: 'hello',
      ts: 100,
      supporter: true,
      channelRole: 'owner',
      countryCode: 'FI',
      href: '/u/dj',
    })
    expect(msg?.id).toBeTruthy()
  })

  it('defaults handle and ts', () => {
    const before = Date.now()
    const msg = parseInboundPush({ text: 'hi' })
    expect(msg?.handle).toBe('anon')
    expect(msg?.ts).toBeGreaterThanOrEqual(before)
  })
})
