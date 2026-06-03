// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  buildArtistYearBreakdown,
  formatArtistYearBreakdown,
  SCENARIO_BREAK_EVEN,
  SCENARIO_LOSS_50_EUR,
  SCENARIO_PROFIT_50_EUR,
  simulateFanSubYear,
} from './artist-year-economics.js'

describe('artist year economics scenarios', () => {
  it('profit ~€50: music on platform, 2 supporters × €5 × 10 months', () => {
    const b = buildArtistYearBreakdown(SCENARIO_PROFIT_50_EUR)
    const fan = b.fanSub!

    expect(fan.chargeCount).toBe(20)
    expect(fan.grossCents).toBe(10_000)
    expect(fan.stripeFeeCents).toBe(900) // 20 × €0.45
    expect(fan.orgFeeCents).toBe(200) // 20 × €0.10
    expect(fan.netToArtistCents).toBe(8900) // 20 × €4.45
    expect(b.netProfitCents).toBe(5000) // €89 fan net + €1 grant − €40 membership

    // Documented breakdown (stable snapshot for reviewers)
    expect(formatArtistYearBreakdown(b)).toMatchInlineSnapshot(`
"Scenario: Published music, supporters, ~€50 net (profit-50)
Long Doe releases mixes on Tahti, runs a free-tier channel, and keeps ~2 fans at €5/mo for 10 months. A small engagement grant tops up fan-sub net to €50 after membership.

Money flow (artist perspective):
  +€100.00  Fan subscriptions (gross) — 2 supporter(s) × €5.00/mo × 10 mo
  −€9.00  Stripe processing — 2.9% + €0.30 per successful charge (EU card)
  −€2.00  Tahti operational fee (2%) — Passthrough — covers Connect, GDPR, support (not org profit)
  +€89.00  Net from fan-subs to artist — Paid out via Stripe Connect
  +€1.00  Annual engagement grant — M9 pool share from platform surplus (engagement units)
  −€40.00  Tahti membership — Artist tier — broadcast, archive, fan-sub tooling
  +€50.00  Net profit (year) — Fan-sub net + grant − membership

Net profit: €50.00"
`)
  })

  it('loss −€50: paid membership (€50), no supporter payments', () => {
    const b = buildArtistYearBreakdown(SCENARIO_LOSS_50_EUR)

    expect(b.fanSub).toBeNull()
    expect(b.netProfitCents).toBe(-5000)

    expect(formatArtistYearBreakdown(b)).toContain('−€50.00  Tahti membership')
    expect(formatArtistYearBreakdown(b)).toContain('Net profit: €-50.00')
  })

  it('break even: one supporter × €5 × 9 months vs €40 membership', () => {
    const b = buildArtistYearBreakdown(SCENARIO_BREAK_EVEN)
    const fan = b.fanSub!

    expect(fan.chargeCount).toBe(9)
    expect(fan.netToArtistCents).toBe(4005) // 9 × €4.45
    expect(b.netProfitCents).toBe(5) // within one €0.05 charge rounding band

    // Tune to exact zero if we prefer: 9 months leaves +€0.05; acceptable "break even"
    expect(Math.abs(b.netProfitCents)).toBeLessThanOrEqual(10)
  })

  it('each fan charge split still sums to gross (sanity)', () => {
    const fan = simulateFanSubYear({ supporters: 2, monthlyGrossCents: 500, months: 10 })
    expect(fan.stripeFeeCents + fan.orgFeeCents + fan.netToArtistCents).toBe(fan.grossCents)
  })
})
