// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { computeFanSubSplit, type FanSubSplit } from './fansub.js'

/** Tahti artist membership (M1), default €40/year. */
export const TAHTI_MEMBERSHIP_YEAR_CENTS = 4000

export interface FanSubYearInput {
  /** Distinct paying supporters. */
  supporters: number
  /** Gross charge per supporter per month (e.g. 500 = €5.00). */
  monthlyGrossCents: number
  /** Billing months in the fiscal year (usually 12). */
  months: number
}

export interface FanSubYearTotals {
  chargeCount: number
  grossCents: number
  stripeFeeCents: number
  orgFeeCents: number
  netToArtistCents: number
}

/** Sum monthly fan-sub charges (one Stripe charge per supporter per month). */
export function simulateFanSubYear(input: FanSubYearInput): FanSubYearTotals {
  const supporters = Math.max(0, Math.floor(input.supporters))
  const months = Math.max(0, Math.floor(input.months))
  const monthlyGrossCents = Math.max(0, Math.round(input.monthlyGrossCents))
  const chargeCount = supporters * months

  let grossCents = 0
  let stripeFeeCents = 0
  let orgFeeCents = 0
  let netToArtistCents = 0

  for (let i = 0; i < chargeCount; i++) {
    const split: FanSubSplit = computeFanSubSplit(monthlyGrossCents)
    grossCents += split.grossCents
    stripeFeeCents += split.stripeFeeCents
    orgFeeCents += split.orgFeeCents
    netToArtistCents += split.netToArtistCents
  }

  return { chargeCount, grossCents, stripeFeeCents, orgFeeCents, netToArtistCents }
}

export interface MoneyLine {
  /** Human label for reports / tests. */
  label: string
  /** Signed cents: positive = cash to artist, negative = cash from artist. */
  cents: number
  detail?: string
}

export interface ArtistYearScenario {
  id: string
  title: string
  /** Short story for docs and test output. */
  narrative: string
  membershipCents: number
  fanSub: FanSubYearInput | null
  /** Annual grant disbursement (M9), cents to artist. */
  grantCents: number
}

export interface ArtistYearBreakdown {
  scenario: ArtistYearScenario
  fanSub: FanSubYearTotals | null
  lines: MoneyLine[]
  /** fanSub net + grant − membership */
  netProfitCents: number
}

export function buildArtistYearBreakdown(scenario: ArtistYearScenario): ArtistYearBreakdown {
  const fanSub = scenario.fanSub ? simulateFanSubYear(scenario.fanSub) : null
  const lines: MoneyLine[] = []

  if (fanSub && fanSub.chargeCount > 0) {
    const { supporters = 0, monthlyGrossCents = 0, months = 0 } = scenario.fanSub ?? {}
    lines.push({
      label: 'Fan subscriptions (gross)',
      cents: fanSub.grossCents,
      detail: `${supporters} supporter(s) × €${(monthlyGrossCents / 100).toFixed(2)}/mo × ${months} mo`,
    })
    lines.push({
      label: 'Stripe processing',
      cents: -fanSub.stripeFeeCents,
      detail: '2.9% + €0.30 per successful charge (EU card)',
    })
    lines.push({
      label: 'Tahti operational fee (2%)',
      cents: -fanSub.orgFeeCents,
      detail: 'Passthrough — covers Connect, GDPR, support (not org profit)',
    })
    lines.push({
      label: 'Net from fan-subs to artist',
      cents: fanSub.netToArtistCents,
      detail: 'Paid out via Stripe Connect',
    })
  } else {
    lines.push({
      label: 'Fan subscriptions (gross)',
      cents: 0,
      detail: 'No paying supporters this year',
    })
    lines.push({
      label: 'Net from fan-subs to artist',
      cents: 0,
    })
  }

  if (scenario.grantCents > 0) {
    lines.push({
      label: 'Annual engagement grant',
      cents: scenario.grantCents,
      detail: 'M9 pool share from platform surplus (engagement units)',
    })
  }

  lines.push({
    label: 'Tahti membership',
    cents: -scenario.membershipCents,
    detail: 'Artist tier — broadcast, archive, fan-sub tooling',
  })

  const fanNet = fanSub?.netToArtistCents ?? 0
  const netProfitCents = fanNet + scenario.grantCents - scenario.membershipCents

  lines.push({
    label: 'Net profit (year)',
    cents: netProfitCents,
    detail: 'Fan-sub net + grant − membership',
  })

  return { scenario, fanSub, lines, netProfitCents }
}

/** Music up all year, modest supporter base → about €50 net after membership. */
export const SCENARIO_PROFIT_50_EUR: ArtistYearScenario = {
  id: 'profit-50',
  title: 'Published music, supporters, ~€50 net',
  narrative:
    'Long Doe releases mixes on Tahti, runs a free-tier channel, and keeps ~2 fans at €5/mo for 10 months. A small engagement grant tops up fan-sub net to €50 after membership.',
  membershipCents: TAHTI_MEMBERSHIP_YEAR_CENTS,
  fanSub: { supporters: 2, monthlyGrossCents: 500, months: 10 },
  grantCents: 100,
}

/** Paid platform fee, no supporter income → −€50. */
export const SCENARIO_LOSS_50_EUR: ArtistYearScenario = {
  id: 'loss-50',
  title: 'Paid membership, no earnings',
  narrative:
    'Casey uploads music and pays for Tahti but never attracts paying fan-subscribers. Only cost is membership (€50 in this story — e.g. higher list price or first-year bundle).',
  membershipCents: 5000,
  fanSub: null,
  grantCents: 0,
}

/** Fan-sub net exactly covers membership. */
export const SCENARIO_BREAK_EVEN: ArtistYearScenario = {
  id: 'break-even',
  title: 'Supporters cover membership',
  narrative:
    'River has one dedicated fan at €5/mo for 9 months — fan-sub net roughly equals the €40 membership.',
  membershipCents: TAHTI_MEMBERSHIP_YEAR_CENTS,
  fanSub: { supporters: 1, monthlyGrossCents: 500, months: 9 },
  grantCents: 0,
}

/** Format breakdown for assertions / console (tests). */
export function formatArtistYearBreakdown(b: ArtistYearBreakdown): string {
  const eur = (c: number) => `€${(c / 100).toFixed(2)}`
  const rows = b.lines.map((l) => {
    const sign = l.cents >= 0 ? '+' : '−'
    const amt = eur(Math.abs(l.cents))
    const extra = l.detail ? ` — ${l.detail}` : ''
    return `  ${sign}${amt}  ${l.label}${extra}`
  })
  return [
    `Scenario: ${b.scenario.title} (${b.scenario.id})`,
    b.scenario.narrative,
    '',
    'Money flow (artist perspective):',
    ...rows,
    '',
    `Net profit: ${eur(b.netProfitCents)}`,
  ].join('\n')
}
