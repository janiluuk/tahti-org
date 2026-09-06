// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  CreateGovernanceMeetingSchema,
  CreateMotionSchema,
  PatchGovernanceMeetingSchema,
  PatchMotionSchema,
  VoteMotionSchema,
} from './governance.js'

describe('governance DTOs', () => {
  it('accepts valid create motion body', () => {
    const parsed = CreateMotionSchema.safeParse({
      title: 'Approve budget',
      description: 'Motion text here.',
      openAt: '2026-06-01T00:00:00.000Z',
      closeAt: '2026-06-15T00:00:00.000Z',
      advisory: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects closeAt before openAt', () => {
    const parsed = CreateMotionSchema.safeParse({
      title: 'Bad dates',
      description: 'x',
      openAt: '2026-06-15T00:00:00.000Z',
      closeAt: '2026-06-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts vote choice', () => {
    expect(VoteMotionSchema.safeParse({ choice: 'YES' }).success).toBe(true)
    expect(VoteMotionSchema.safeParse({ choice: 'MAYBE' }).success).toBe(false)
  })

  it('accepts patch state', () => {
    expect(PatchMotionSchema.safeParse({ state: 'OPEN' }).success).toBe(true)
  })

  it('accepts meeting officer names and treats a blank name as null', () => {
    const created = CreateGovernanceMeetingSchema.safeParse({
      title: 'Board meeting',
      type: 'BOARD',
      chairName: 'Aino Chair',
      secretaryName: '  ',
    })
    expect(created.success).toBe(true)
    if (created.success) {
      expect(created.data.chairName).toBe('Aino Chair')
      expect(created.data.secretaryName).toBeNull()
    }

    const patched = PatchGovernanceMeetingSchema.safeParse({
      minutesSignedByName: 'Aino Chair',
      minutesSignedAt: '2026-06-15T18:00:00.000Z',
      secretaryName: '',
    })
    expect(patched.success).toBe(true)
    if (patched.success) {
      expect(patched.data.minutesSignedByName).toBe('Aino Chair')
      expect(patched.data.secretaryName).toBeNull()
      expect(patched.data.minutesSignedAt?.toISOString()).toBe('2026-06-15T18:00:00.000Z')
    }
  })
})
