// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const LedgerEntryCreatedSchema = z.object({
  id: z.string(),
  category: z.string(),
  amountCents: z.string(),
})

export const LedgerEntryViewSchema = z
  .object({
    id: z.string(),
    category: z.string(),
    amountCents: z.string(),
    currency: z.string(),
    description: z.string(),
    createdAt: z.coerce.date(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  })
  .passthrough()

export const LedgerEntryListSchema = z.array(LedgerEntryViewSchema)
