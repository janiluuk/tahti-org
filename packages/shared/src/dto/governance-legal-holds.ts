// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GovernanceLegalHoldKindSchema = z.enum([
  'MEETING',
  'DOCUMENT',
  'RESOLUTION',
  'ANNUAL_REPORT',
])

/** GET /api/admin/governance/legal-holds — every record under a legal hold,
 * newest hold first. `id` is the record's own id (the year for a report). */
export const GovernanceLegalHoldListSchema = z.array(
  z.object({
    kind: GovernanceLegalHoldKindSchema,
    id: z.string(),
    title: z.string(),
    legalHoldAt: z.coerce.date(),
    legalHoldReason: z.string().nullable(),
  }),
)

/** ?kind=MEETING,DOCUMENT — only these kinds of record. */
export const GovernanceLegalHoldQuerySchema = z.object({
  kind: z
    .string()
    .transform((raw) => [...new Set(raw.split(',').map((value) => value.trim()))])
    .pipe(z.array(GovernanceLegalHoldKindSchema).min(1))
    .optional(),
})
