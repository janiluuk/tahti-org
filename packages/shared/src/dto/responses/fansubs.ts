// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const FanSubCheckoutUrlResponseSchema = z.object({
  checkoutUrl: z.string().nullable(),
  sessionId: z.string(),
})

export const FanSubActivatedResponseSchema = z.object({
  activated: z.literal(true),
  subscriptionId: z.string(),
  tierName: z.string(),
  amountCents: z.number().int(),
  currentPeriodEnd: z.coerce.date(),
})

export const FanSubSubscriptionViewSchema = z.object({
  id: z.string(),
  tierName: z.string(),
  amountCents: z.number().int(),
  state: z.string(),
  currentPeriodEnd: z.coerce.date(),
  canceledAt: z.coerce.date().nullable(),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
  }),
})

export const FanSubSubscriptionListSchema = z.array(FanSubSubscriptionViewSchema)

export const FanSubCancelResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  canceledAt: z.coerce.date().nullable(),
  currentPeriodEnd: z.coerce.date(),
  accessUntil: z.coerce.date(),
  message: z.string(),
})

export const FanConnectStatusResponseSchema = z.object({
  stripeConfigured: z.boolean(),
  accountId: z.string().nullable(),
  chargesEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  paymentsReady: z.boolean(),
})

export const FanConnectOnboardResponseSchema = z.object({
  onboardingUrl: z.string().url(),
  accountId: z.string(),
})

export const FanTierPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  amountCents: z.number().int(),
  description: z.string().nullable(),
  perks: z.array(z.string()),
})

export const FanTiersPublicResponseSchema = z.object({
  artist: z.object({
    id: z.string(),
    displayName: z.string(),
    username: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  tiers: z.array(FanTierPublicSchema),
  paymentsReady: z.boolean(),
})

export const FanSubPayoutsDashboardSchema = z.object({
  pending: z.number().int(),
  failed: z.number().int(),
  paidLast30Days: z.number().int(),
  activeSubscribers: z.number().int(),
  thisMonthNetCents: z.number().int(),
  paidYtdNetCents: z.number().int(),
  recent: z.array(
    z.object({
      id: z.string(),
      state: z.string(),
      tierName: z.string(),
      grossCents: z.number().int(),
      netToArtistCents: z.number().int(),
      forPeriodStart: z.coerce.date(),
      forPeriodEnd: z.coerce.date(),
      paidAt: z.coerce.date().nullable(),
      createdAt: z.coerce.date(),
    }),
  ),
})

// PERF-006: dashboard overview only ever reads thisMonthNetCents for a single KPI —
// avoids the 7-query FanSubPayoutsDashboardSchema payload's counts/aggregates/recent list.
export const FanSubPayoutsSummarySchema = z.object({
  thisMonthNetCents: z.number().int(),
})

export const FanConnectPortalResponseSchema = z.object({
  url: z.string().url(),
})
