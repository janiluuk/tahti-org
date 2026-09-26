// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { containsEmailAddress, safeDisplayName } from './display-name.js'

describe('containsEmailAddress', () => {
  it.each([
    'janiluuk@gmail.com',
    'janiluuk+4@gmail.com',
    'DJ x (me@example.fi)',
    'A.B@sub.domain.org',
  ])('detects %s', (text) => {
    expect(containsEmailAddress(text)).toBe(true)
  })

  it.each(['Yaniho', 'DJ @ Night', 'Mr. B', 'user@localhost', '@handle', 'Rock & Roll'])(
    'accepts %s',
    (text) => {
      expect(containsEmailAddress(text)).toBe(false)
    },
  )
})

describe('safeDisplayName', () => {
  it('keeps a normal name', () => {
    expect(safeDisplayName('  Yaniho ', 'yaniho')).toBe('Yaniho')
  })

  it('falls back to the username for an email or an empty name', () => {
    expect(safeDisplayName('janiluuk@gmail.com', 'mrb')).toBe('mrb')
    expect(safeDisplayName('', 'mrb')).toBe('mrb')
    expect(safeDisplayName(null, 'mrb')).toBe('mrb')
  })
})

describe('display name schemas', () => {
  it('reject an email address as a display name', async () => {
    const { RegisterSchema, ProfilePatchSchema, AdminBetaApproveSchema } =
      await import('./index.js')
    const register = RegisterSchema.safeParse({
      email: 'me@example.com',
      password: 'Correct-horse-battery-9',
      username: 'mrb',
      displayName: 'me@example.com',
    })
    expect(register.success).toBe(false)
    expect(register.error?.issues.map((issue) => issue.message)).toContain(
      "Display name can't contain an email address",
    )
    expect(ProfilePatchSchema.safeParse({ displayName: 'me@example.com' }).success).toBe(false)
    expect(
      AdminBetaApproveSchema.safeParse({ username: 'mrb', displayName: 'me@example.com' }).success,
    ).toBe(false)
    expect(ProfilePatchSchema.safeParse({ displayName: 'Mr. B' }).success).toBe(true)
  })
})
