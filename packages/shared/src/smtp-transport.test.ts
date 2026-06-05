// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, describe, expect, it } from 'vitest'
import { smtpTransportOptions } from './smtp-transport.js'

describe('smtpTransportOptions', () => {
  const originalSecure = process.env.SMTP_SECURE

  afterEach(() => {
    if (originalSecure === undefined) delete process.env.SMTP_SECURE
    else process.env.SMTP_SECURE = originalSecure
  })

  it('uses plain SMTP for mailhog port 1025', () => {
    const opts = smtpTransportOptions({ host: 'mailhog', port: 1025 })
    expect(opts.secure).toBe(false)
    expect(opts.requireTLS).toBe(false)
  })

  it('uses implicit TLS on port 465', () => {
    const opts = smtpTransportOptions({ host: 'smtp.example.com', port: 465 })
    expect(opts.secure).toBe(true)
    expect(opts.requireTLS).toBe(false)
  })

  it('uses STARTTLS on port 587', () => {
    const opts = smtpTransportOptions({ host: 'smtp.example.com', port: 587 })
    expect(opts.secure).toBe(false)
    expect(opts.requireTLS).toBe(true)
  })

  it('honours SMTP_SECURE=false override', () => {
    process.env.SMTP_SECURE = 'false'
    const opts = smtpTransportOptions({ host: 'smtp.example.com', port: 587 })
    expect(opts.secure).toBe(false)
    expect(opts.requireTLS).toBe(false)
  })
})
