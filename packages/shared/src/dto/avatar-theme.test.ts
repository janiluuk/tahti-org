// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  AvatarThemeSchema,
  avatarThemeCss,
  avatarThemeFromId,
  parseAvatarTheme,
  randomAvatarTheme,
  resolveAvatarTheme,
} from './avatar-theme.js'

describe('avatar-theme', () => {
  it('validates solid and gradient themes', () => {
    expect(AvatarThemeSchema.parse({ kind: 'solid', colors: ['#22D3EE'] })).toEqual({
      kind: 'solid',
      colors: ['#22D3EE'],
    })
    expect(
      AvatarThemeSchema.parse({
        kind: 'gradient',
        colors: ['#A78BFA', '#22D3EE'],
        angle: 135,
      }),
    ).toMatchObject({ kind: 'gradient' })
  })

  it('rejects invalid hex', () => {
    expect(AvatarThemeSchema.safeParse({ kind: 'solid', colors: ['cyan'] }).success).toBe(false)
  })

  it('builds css for solid and gradient', () => {
    expect(avatarThemeCss({ kind: 'solid', colors: ['#22D3EE'] })).toBe('#22D3EE')
    expect(avatarThemeCss({ kind: 'gradient', colors: ['#A78BFA', '#22D3EE'], angle: 135 })).toBe(
      'linear-gradient(135deg, #A78BFA, #22D3EE)',
    )
  })

  it('is deterministic from id', () => {
    expect(avatarThemeFromId('alice')).toEqual(avatarThemeFromId('alice'))
    expect(avatarThemeCss(avatarThemeFromId('alice'))).not.toBe(
      avatarThemeCss(avatarThemeFromId('bob')),
    )
  })

  it('parses stored json and falls back via resolve', () => {
    const stored = JSON.stringify({ kind: 'solid', colors: ['#FFB840'] })
    expect(parseAvatarTheme(stored)).toEqual({ kind: 'solid', colors: ['#FFB840'] })
    expect(parseAvatarTheme('nope')).toBeNull()
    expect(resolveAvatarTheme(stored, 'x')).toEqual({ kind: 'solid', colors: ['#FFB840'] })
    expect(resolveAvatarTheme(null, 'x')).toEqual(avatarThemeFromId('x'))
  })

  it('shuffles to a different preset when possible', () => {
    const first = avatarThemeFromId('seed')
    const next = randomAvatarTheme(first)
    expect(avatarThemeCss(next)).not.toBe(avatarThemeCss(first))
  })
})
