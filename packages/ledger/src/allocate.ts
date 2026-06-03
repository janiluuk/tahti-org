// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

// Pure, deterministic grant allocation. No I/O — given a year's surplus and
// each artist's engagement units, it produces exact per-artist grant amounts
// in cents. Uses the largest-remainder (Hamilton) method so the allocations
// sum to the pool exactly, with no rounding drift.
//
// Grant basis is engagement units (docs/engagement-and-fansubs.md), NOT
// listener-hours. See docs/planning-decisions.md Topic 8.

export interface ArtistUnits {
  userId: string
  units: number
}

export interface GrantAllocation {
  userId: string
  units: number
  amountCents: number
}

export interface AllocationResult {
  surplusCents: number
  reserveCents: number
  poolCents: number
  totalUnits: number
  allocations: GrantAllocation[]
  /** Pool cents not allocated (no eligible artists) — rolls to next year. */
  unallocatedCents: number
}

export interface AllocateOptions {
  surplusCents: number
  /** Operating reserve fraction held back before distribution. Default 0.10. */
  reservePct?: number
  /** Minimum engagement units for an artist to qualify. Default 5. */
  minUnits?: number
  artists: ArtistUnits[]
}

export function allocateGrants(opts: AllocateOptions): AllocationResult {
  const reservePct = opts.reservePct ?? 0.1
  const minUnits = opts.minUnits ?? 5
  const surplusCents = Math.max(0, Math.floor(opts.surplusCents))

  // No surplus → nothing to distribute, nothing reserved.
  if (surplusCents <= 0) {
    return {
      surplusCents: opts.surplusCents,
      reserveCents: 0,
      poolCents: 0,
      totalUnits: 0,
      allocations: [],
      unallocatedCents: 0,
    }
  }

  const reserveCents = Math.floor(surplusCents * reservePct)
  const poolCents = surplusCents - reserveCents

  const eligible = opts.artists.filter((a) => a.units >= minUnits && a.units > 0)
  const totalUnits = eligible.reduce((s, a) => s + a.units, 0)

  if (totalUnits === 0 || poolCents === 0) {
    return {
      surplusCents,
      reserveCents,
      poolCents,
      totalUnits,
      allocations: [],
      unallocatedCents: poolCents,
    }
  }

  // Largest-remainder method: floor each share, then hand out the leftover
  // cents one at a time to the largest fractional remainders.
  const raw = eligible.map((a) => {
    const exact = (poolCents * a.units) / totalUnits
    const floorCents = Math.floor(exact)
    return { userId: a.userId, units: a.units, floorCents, remainder: exact - floorCents }
  })

  let distributed = raw.reduce((s, r) => s + r.floorCents, 0)
  let leftover = poolCents - distributed

  // Stable ordering: larger remainder first, then more units, then userId.
  const order = [...raw].sort(
    (a, b) => b.remainder - a.remainder || b.units - a.units || a.userId.localeCompare(b.userId),
  )
  const bonus = new Map<string, number>()
  for (let i = 0; i < order.length && leftover > 0; i++) {
    bonus.set(order[i].userId, 1)
    leftover -= 1
  }

  const allocations: GrantAllocation[] = raw.map((r) => ({
    userId: r.userId,
    units: r.units,
    amountCents: r.floorCents + (bonus.get(r.userId) ?? 0),
  }))

  distributed = allocations.reduce((s, a) => s + a.amountCents, 0)

  return {
    surplusCents,
    reserveCents,
    poolCents,
    totalUnits,
    allocations,
    unallocatedCents: poolCents - distributed,
  }
}
