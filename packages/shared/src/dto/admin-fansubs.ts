// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminFanSubPayoutStateQuerySchema = z.object({
  state: z.enum(['PENDING', 'FAILED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const AdminFanSubOverviewSchema = z.object({
  activeFanSubCount: z.number().int().nonnegative(),
  mrrCents: z.number().int().nonnegative(),
  artistsWithSubscribers: z.number().int().nonnegative(),
  pendingPayouts: z.object({
    count: z.number().int().nonnegative(),
    totalNetCents: z.number().int().nonnegative(),
  }),
  failedPayouts: z.object({
    count: z.number().int().nonnegative(),
    totalNetCents: z.number().int().nonnegative(),
  }),
})

export const AdminFanSubPayoutRowSchema = z.object({
  id: z.string(),
  state: z.string(),
  artistUserId: z.string(),
  artistDisplayName: z.string(),
  artistUsername: z.string(),
  subscriberDisplayName: z.string(),
  subscriberUsername: z.string(),
  netToArtistCents: z.number().int(),
  grossCents: z.number().int(),
  forPeriodStart: z.coerce.date(),
  forPeriodEnd: z.coerce.date(),
  stripeTransferId: z.string().nullable(),
  paidAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const AdminFanSubPayoutListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  payouts: z.array(AdminFanSubPayoutRowSchema),
})

export const AdminFanSubArtistRowSchema = z.object({
  artistUserId: z.string(),
  displayName: z.string(),
  username: z.string(),
  activeSubscriberCount: z.number().int().nonnegative(),
  mrrCents: z.number().int().nonnegative(),
  totalPaidCents: z.number().int().nonnegative(),
  stripeConnectChargesEnabled: z.boolean(),
  stripeConnectAccountId: z.string().nullable(),
})

export const AdminFanSubArtistListSchema = z.array(AdminFanSubArtistRowSchema)

export const AdminFanSubPayoutRetrySchema = z.object({
  ok: z.literal(true),
  payoutId: z.string(),
  state: z.string(),
})
