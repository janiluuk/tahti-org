// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BETA_APPLY_MAX_LINKS = 10
export const BETA_APPLY_MAX_LINK_LENGTH = 500
export const BETA_APPLY_MAX_LINKS_TOTAL = 2000

/** Normalize one string or many link fields into a newline-separated string for storage. */
export function normalizeBetaApplyLinks(links: string | string[] | undefined): string | undefined {
  if (links === undefined) return undefined

  const parts = (Array.isArray(links) ? links : links.split(/\n|,/))
    .map((part) => part.trim())
    .filter(Boolean)

  const unique = [...new Set(parts)]
  if (!unique.length) return undefined

  const joined = unique.join('\n')
  return joined.length > BETA_APPLY_MAX_LINKS_TOTAL
    ? joined.slice(0, BETA_APPLY_MAX_LINKS_TOTAL)
    : joined
}

export const BetaApplyLinksSchema = z
  .union([
    z.string().trim().max(BETA_APPLY_MAX_LINKS_TOTAL),
    z.array(z.string().trim().max(BETA_APPLY_MAX_LINK_LENGTH)).max(BETA_APPLY_MAX_LINKS),
  ])
  .optional()
  .transform((value) => normalizeBetaApplyLinks(value))

export const BetaApplySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email is required'),
  artistType: z.string().trim().min(1, 'Artist type is required').max(200),
  links: BetaApplyLinksSchema,
  message: z.string().trim().max(5000).optional(),
})

export const BetaApplyResponseSchema = z.object({
  ok: z.literal(true),
  ticketId: z.string().optional(),
  applicationId: z.string().optional(),
})

export type BetaApplyInput = z.infer<typeof BetaApplySchema>

/** Inbox for private beta application notifications (always this address). */
export const BETA_SUPPORT_INBOX = 'support@tahti.live' as const
