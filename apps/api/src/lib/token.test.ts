// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  generateSessionId,
  generateVerificationToken,
  sessionExpiresAt,
  verificationExpiresAt,
} from './token.js'

describe('generateSessionId', () => {
  it('returns a 40-character string', () => {
    expect(generateSessionId()).toHaveLength(40)
  })

  it('returns unique values', () => {
    expect(generateSessionId()).not.toBe(generateSessionId())
  })
})

describe('generateVerificationToken', () => {
  it('returns a 32-character string', () => {
    expect(generateVerificationToken()).toHaveLength(32)
  })

  it('returns unique values', () => {
    expect(generateVerificationToken()).not.toBe(generateVerificationToken())
  })
})

describe('sessionExpiresAt', () => {
  it('is ~30 days in the future', () => {
    const now = Date.now()
    const expires = sessionExpiresAt().getTime()
    const diff = expires - now
    const days = diff / (1000 * 60 * 60 * 24)
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)
  })
})

describe('verificationExpiresAt', () => {
  it('is ~24 hours in the future', () => {
    const now = Date.now()
    const expires = verificationExpiresAt().getTime()
    const diff = expires - now
    const hours = diff / (1000 * 60 * 60)
    expect(hours).toBeGreaterThan(23)
    expect(hours).toBeLessThan(25)
  })
})
