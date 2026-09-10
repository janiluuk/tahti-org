// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MembershipStatusResponseSchema = z.object({
  status: z.string(),
  isMember: z.boolean(),
  memberNumber: z.number().int().nullable(),
  memberSince: z.coerce.date().nullable(),
  tier: z.string(),
  priceCents: z.number().int(),
  emailVerified: z.boolean(),
  renewalDueAt: z.coerce.date().nullable().optional(),
  hasStripeSubscription: z.boolean().optional(),
  subscriptionMigrationRequired: z.boolean().optional(),
  stripeEnabled: z.boolean().optional(),
})

export const StripeCheckoutUrlResponseSchema = z.object({
  checkoutUrl: z.string().nullable(),
  sessionId: z.string(),
})

export const MembershipDevActivateResponseSchema = z.object({
  activated: z.literal(true),
  memberNumber: z.number().int(),
  message: z.string(),
})

export const MembershipCheckoutBodySchema = z.object({
  successPath: z.string().max(256).optional(),
  cancelPath: z.string().max(256).optional(),
})

export const MembershipCheckoutResponseSchema = z.union([
  StripeCheckoutUrlResponseSchema,
  MembershipDevActivateResponseSchema,
])

export const BillingPortalUrlResponseSchema = z.object({
  portalUrl: z.string().nullable(),
})

export const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  status: z.string().nullable(),
  amountPaidCents: z.number().int(),
  currency: z.string(),
  created: z.string().datetime(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
})

export const InvoicesResponseSchema = z.object({
  invoices: z.array(InvoiceSchema),
})
