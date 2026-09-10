// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const NewsletterSubscriberStatsSchema = z.object({
  total: z.number().int(),
  confirmed: z.number().int(),
  newLast30Days: z.number().int(),
  /** Of `confirmed`, how many also hold an active fan-sub tier with the FAN_NEWSLETTER perk. */
  fanSubscriberCount: z.number().int(),
})

export const NewsletterSubscribeStatusSchema = z.object({
  status: z.string(),
})

/** Logged-in viewer's subscription state to a specific artist's newsletter. */
export const NewsletterMySubscriptionSchema = z.object({
  subscribed: z.boolean(),
})

export const NewsletterDraftSummarySchema = z.object({
  id: z.string(),
  subject: z.string(),
  state: z.string(),
  sentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  subscribersOnly: z.boolean(),
  _count: z.object({ sends: z.number().int() }),
})

export const NewsletterDraftListSchema = z.array(NewsletterDraftSummarySchema)

// PERF-008: was a fully unbounded findMany.
export const NewsletterDraftListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const NewsletterDraftPagedListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  drafts: NewsletterDraftListSchema,
})

export const NewsletterDraftViewSchema = NewsletterDraftSummarySchema.extend({
  bodyMd: z.string(),
  updatedAt: z.coerce.date().optional(),
}).passthrough()
