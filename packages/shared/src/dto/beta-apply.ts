// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BetaApplySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email is required'),
  artistType: z.string().trim().min(1, 'Artist type is required').max(200),
  links: z.string().trim().max(2000).optional(),
  message: z.string().trim().max(5000).optional(),
})

export const BetaApplyResponseSchema = z.object({
  ok: z.literal(true),
  ticketId: z.string().optional(),
})

export type BetaApplyInput = z.infer<typeof BetaApplySchema>
