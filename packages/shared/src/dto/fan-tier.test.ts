// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { FanTierBodySchema, FanSubCheckoutSchema } from './fan-tier.js'

describe('fan tier DTOs', () => {
  it('accepts valid tier body', () => {
    const parsed = FanTierBodySchema.safeParse({
      name: 'Supporter',
      amountCents: 500,
      perks: ['  FAN_CHAT  ', ''],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.perks).toEqual(['FAN_CHAT'])
  })

  it('rejects amount below €1', () => {
    expect(FanTierBodySchema.safeParse({ name: 'X', amountCents: 50 }).success).toBe(false)
  })

  it('requires tierId for checkout', () => {
    expect(FanSubCheckoutSchema.safeParse({}).success).toBe(false)
  })
})
