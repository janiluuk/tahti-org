// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure money split for a single fan-subscription charge. Given the gross amount
// a fan paid, returns the Stripe processing fee, the 2% operational fee the org
// retains (passthrough, not revenue — bylaws §11.b), and the net the artist
// receives via Stripe Connect. See docs/engagement-and-fansubs.md "money flow".
//
// Worked example: €5.00 → Stripe €0.45, org €0.10, artist €4.45.

// Stripe standard EU pricing: 2.9% + €0.30 per successful charge.
const STRIPE_PCT = 0.029
const STRIPE_FIXED_CENTS = 30
// Operational fee retained by the org (covers Connect platform fees, GDPR,
// disputes, support, audit attribution).
const ORG_FEE_PCT = 0.02

export interface FanSubSplit {
  grossCents: number
  stripeFeeCents: number
  orgFeeCents: number
  netToArtistCents: number
}

export function computeFanSubSplit(grossCents: number): FanSubSplit {
  const gross = Math.max(0, Math.round(grossCents))
  const stripeFeeCents = Math.round(gross * STRIPE_PCT) + (gross > 0 ? STRIPE_FIXED_CENTS : 0)
  const orgFeeCents = Math.round(gross * ORG_FEE_PCT)
  const netToArtistCents = gross - stripeFeeCents - orgFeeCents
  return { grossCents: gross, stripeFeeCents, orgFeeCents, netToArtistCents }
}
