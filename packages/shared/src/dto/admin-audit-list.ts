// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminAuditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(64).optional(),
  actorId: z.string().trim().max(64).optional(),
  targetId: z.string().trim().max(64).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
})

export const AdminAuditListItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string(),
  targetId: z.string().nullable(),
  meta: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  actorDisplayName: z.string().nullable(),
  actorUsername: z.string().nullable(),
})

export const AdminAuditListResponseSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  items: z.array(AdminAuditListItemSchema),
})

export const AdminForceOfflineResponseSchema = z.object({
  ok: z.literal(true),
  channelId: z.string(),
  slug: z.string(),
})
