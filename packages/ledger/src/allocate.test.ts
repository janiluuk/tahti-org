// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { allocateGrants } from './allocate.js'

describe('allocateGrants', () => {
  it('holds back a 10% reserve and distributes the rest', () => {
    const r = allocateGrants({
      surplusCents: 100_000, // €1,000
      artists: [
        { userId: 'a', units: 100 },
        { userId: 'b', units: 100 },
      ],
    })
    expect(r.reserveCents).toBe(10_000) // €100
    expect(r.poolCents).toBe(90_000) // €900
    expect(r.allocations.map((a) => a.amountCents)).toEqual([45_000, 45_000])
  })

  it('allocations always sum exactly to the pool (no rounding drift)', () => {
    const r = allocateGrants({
      surplusCents: 100_000,
      artists: [
        { userId: 'a', units: 30 },
        { userId: 'b', units: 30 },
        { userId: 'c', units: 30 },
      ],
    })
    const sum = r.allocations.reduce((s, a) => s + a.amountCents, 0)
    expect(sum).toBe(r.poolCents)
    expect(r.unallocatedCents).toBe(0)
    // 90000 / 3 = 30000 exactly here
    expect(r.allocations.map((a) => a.amountCents)).toEqual([30_000, 30_000, 30_000])
  })

  it('distributes leftover cents to the largest remainders', () => {
    // reserve floor(100012*0.1)=10001 → pool 90011; 90011/3 = 30003.67
    // floors 30003 each (90009), 2 cents leftover → first two (tie → a,b) get +1.
    const r = allocateGrants({
      surplusCents: 100_012,
      artists: [
        { userId: 'a', units: 30 },
        { userId: 'b', units: 30 },
        { userId: 'c', units: 30 },
      ],
    })
    expect(r.poolCents).toBe(90_011)
    const sum = r.allocations.reduce((s, a) => s + a.amountCents, 0)
    expect(sum).toBe(90_011)
    expect(r.allocations.map((a) => a.amountCents)).toEqual([30_004, 30_004, 30_003])
  })

  it('excludes artists below the 5-unit eligibility threshold', () => {
    const r = allocateGrants({
      surplusCents: 100_000,
      artists: [
        { userId: 'active', units: 50 },
        { userId: 'inactive', units: 4 },
      ],
    })
    expect(r.allocations).toHaveLength(1)
    expect(r.allocations[0].userId).toBe('active')
    expect(r.allocations[0].amountCents).toBe(90_000)
  })

  it('matches the worked example from the spec within 1 cent', () => {
    // engagement-and-fansubs.md: Long Doe = 3,800 units of 1,000,000 total,
    // grant pool €172,649 → €656 (rounded).
    const others = 1_000_000 - 3_800
    // Pool is given directly here; set surplus so pool == 17,264,900 cents with 0 reserve.
    const r = allocateGrants({
      surplusCents: 17_264_900,
      reservePct: 0,
      artists: [
        { userId: 'long-doe', units: 3_800 },
        { userId: 'rest', units: others },
      ],
    })
    const longDoe = r.allocations.find((a) => a.userId === 'long-doe')!
    // 3800/1_000_000 * 17_264_900 = 65,606.62 cents ≈ €656.07
    expect(Math.abs(longDoe.amountCents - 65_607)).toBeLessThanOrEqual(1)
  })

  it('reserves nothing and pays nothing when there is no surplus', () => {
    const r = allocateGrants({ surplusCents: -5000, artists: [{ userId: 'a', units: 100 }] })
    expect(r.poolCents).toBe(0)
    expect(r.reserveCents).toBe(0)
    expect(r.allocations).toHaveLength(0)
  })

  it('rolls the whole pool to next year when no artist is eligible', () => {
    const r = allocateGrants({
      surplusCents: 100_000,
      artists: [{ userId: 'a', units: 1 }],
    })
    expect(r.allocations).toHaveLength(0)
    expect(r.unallocatedCents).toBe(r.poolCents)
    expect(r.poolCents).toBe(90_000)
  })
})
