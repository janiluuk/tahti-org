// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// PERF-008: was a fully unbounded findMany with an eager shares include.
export const StashListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const StashShareViewSchema = z.object({
  id: z.string(),
  granteeUsername: z.string().nullable(),
  token: z.string(),
  permission: z.string(),
  fileCount: z.number().int(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const StashFileViewSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.string(),
  format: z.string().nullable(),
  bitDepth: z.number().int().nullable(),
  sampleRate: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  shareCount: z.number().int(),
  shares: z.array(StashShareViewSchema),
})

export const StashPagedListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  files: z.array(StashFileViewSchema),
})
