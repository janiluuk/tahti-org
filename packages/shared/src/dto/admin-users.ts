// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  tier: z.enum(['FREE', 'ARTIST', 'STUDIO']).optional(),
  isMember: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  isBoard: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  channelState: z.enum(['LIVE', 'OFFLINE']).optional(),
  search: z.string().trim().max(64).optional(),
  sort: z.enum(['memberNumber', 'displayName', 'createdAt']).default('memberNumber'),
  order: z.enum(['asc', 'desc']).default('asc'),
})

export const AdminUserPatchSchema = z
  .object({
    tier: z.enum(['FREE', 'ARTIST', 'STUDIO']).optional(),
    isMember: z.boolean().optional(),
    isBoard: z.boolean().optional(),
    memberNumber: z.number().int().positive().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export const AdminUserSuspendSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})
