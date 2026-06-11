// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { MoneyBreakdownLine } from './AdminPrimitives'

// Mirrors packages/ledger/src/fansub.ts computeFanSubSplit — Stripe standard
// EU pricing (2.9% + €0.30 per charge) and the 2% Tahti operational fee.
const STRIPE_PCT = 0.029
const STRIPE_FIXED_CENTS = 30
const ORG_FEE_PCT = 0.02

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

/**
 * "Where €X/mo goes" breakdown rows for <MoneyBreakdown> — shared by the fan
 * subscribe page and the artist revenue dashboard.
 */
export function fanSubBreakdownLines(grossCents: number): MoneyBreakdownLine[] {
  const gross = Math.max(0, Math.round(grossCents))
  const stripeFeeCents = Math.round(gross * STRIPE_PCT) + (gross > 0 ? STRIPE_FIXED_CENTS : 0)
  const orgFeeCents = Math.round(gross * ORG_FEE_PCT)
  const netCents = gross - stripeFeeCents - orgFeeCents

  return [
    { label: 'Fan pays', amount: eur(gross) },
    { label: 'Stripe fees', amount: `−${eur(stripeFeeCents)}`, tone: 'amber' },
    { label: 'Tahti ops fee (2%)', amount: `−${eur(orgFeeCents)}`, tone: 'cyan' },
    { label: 'You receive', amount: eur(netCents), tone: 'green', total: true },
  ]
}
