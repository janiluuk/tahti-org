// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { computeFanSubSplit } from './fansub.js'

describe('computeFanSubSplit', () => {
  it('matches the spec worked example (€5.00 → artist €4.45)', () => {
    const s = computeFanSubSplit(500)
    expect(s.stripeFeeCents).toBe(45) // 2.9% of 500 = 14.5 → 15, + 30 = 45
    expect(s.orgFeeCents).toBe(10) // 2% of 500
    expect(s.netToArtistCents).toBe(445)
  })

  it('the three parts always sum to gross', () => {
    for (const gross of [100, 300, 500, 999, 1000, 2500, 10000]) {
      const s = computeFanSubSplit(gross)
      expect(s.stripeFeeCents + s.orgFeeCents + s.netToArtistCents).toBe(gross)
    }
  })

  it('handles €10/month (1000c)', () => {
    const s = computeFanSubSplit(1000)
    expect(s.stripeFeeCents).toBe(59) // 2.9% of 1000 = 29 + 30
    expect(s.orgFeeCents).toBe(20)
    expect(s.netToArtistCents).toBe(921)
  })

  it('charges no fee on a zero gross', () => {
    const s = computeFanSubSplit(0)
    expect(s).toEqual({ grossCents: 0, stripeFeeCents: 0, orgFeeCents: 0, netToArtistCents: 0 })
  })
})
