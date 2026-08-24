// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminLogsQuerySchema = z.object({
  service: z.string().trim().max(64).optional(),
  search: z.string().trim().max(200).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
})

export const AdminLogsEntrySchema = z.object({
  timestampMs: z.number(),
  service: z.string(),
  line: z.string(),
})

export const AdminLogsResponseSchema = z.object({
  entries: z.array(AdminLogsEntrySchema),
  lokiReachable: z.boolean(),
})
