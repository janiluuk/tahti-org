// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const NewsletterDraftSchema = z.object({
  subject: z.string().trim().min(1, 'subject is required').max(200),
  bodyMd: z.string().trim().min(1, 'bodyMd is required').max(50_000),
  subscribersOnly: z.boolean().optional(),
})

export type NewsletterDraftInput = z.infer<typeof NewsletterDraftSchema>

export const NewsletterSendSchema = z.object({
  audience: z.enum(['all', 'fans']).optional(),
})

export type NewsletterSendInput = z.infer<typeof NewsletterSendSchema>

export const NewsletterSubscribeSchema = z.object({
  artistUsername: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_-]+$/i, 'artistUsername is required'),
  email: z.string().trim().email('Valid email is required'),
})

export type NewsletterSubscribeInput = z.infer<typeof NewsletterSubscribeSchema>
