// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  parseEmailBouncePayload,
  shouldUnsubscribeForBounce,
  normalizeEmail,
} from './newsletter-bounce.js'

describe('newsletter-bounce', () => {
  it('parses Postmark hard bounce', () => {
    const parsed = parseEmailBouncePayload({
      RecordType: 'Bounce',
      Type: 'HardBounce',
      Email: 'Fan@Example.com',
    })
    expect(parsed).toEqual({ email: 'Fan@Example.com', kind: 'hard' })
  })

  it('parses Postmark soft bounce', () => {
    const parsed = parseEmailBouncePayload({
      RecordType: 'Bounce',
      Type: 'SoftBounce',
      Email: 'fan@example.com',
    })
    expect(parsed).toEqual({ email: 'fan@example.com', kind: 'soft' })
  })

  it('parses Postmark spam complaint', () => {
    const parsed = parseEmailBouncePayload({
      RecordType: 'SpamComplaint',
      Email: 'fan@example.com',
    })
    expect(parsed).toEqual({ email: 'fan@example.com', kind: 'complaint' })
  })

  it('parses SNS bounce notification', () => {
    const parsed = parseEmailBouncePayload({
      Type: 'Notification',
      Message: JSON.stringify({
        notificationType: 'Bounce',
        bounce: {
          bounceType: 'Permanent',
          bouncedRecipients: [{ emailAddress: 'fan@example.com' }],
        },
      }),
    })
    expect(parsed).toEqual({ email: 'fan@example.com', kind: 'hard' })
  })

  it('parses generic test payload', () => {
    expect(parseEmailBouncePayload({ email: 'a@b.co', type: 'complaint' })).toEqual({
      email: 'a@b.co',
      kind: 'complaint',
    })
  })

  it('shouldUnsubscribeForBounce ignores soft bounces', () => {
    expect(shouldUnsubscribeForBounce('soft')).toBe(false)
    expect(shouldUnsubscribeForBounce('hard')).toBe(true)
    expect(shouldUnsubscribeForBounce('complaint')).toBe(true)
  })

  it('normalizeEmail lowercases', () => {
    expect(normalizeEmail('  Fan@Example.COM ')).toBe('fan@example.com')
  })
})
