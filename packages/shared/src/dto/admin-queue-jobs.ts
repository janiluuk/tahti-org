// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminQueueJobStateSchema = z.enum([
  'waiting',
  'active',
  'delayed',
  'failed',
  'completed',
])

export type AdminQueueJobState = z.infer<typeof AdminQueueJobStateSchema>

export const AdminQueueJobSubjectSchema = z.object({
  kind: z.enum(['sound', 'unknown']),
  id: z.string().nullable(),
  title: z.string().nullable(),
  ownerUsername: z.string().nullable(),
})

export const AdminQueueJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: AdminQueueJobStateSchema,
  timestamp: z.string().datetime().nullable(),
  processedOn: z.string().datetime().nullable(),
  finishedOn: z.string().datetime().nullable(),
  attemptsMade: z.number().int().nonnegative(),
  failedReason: z.string().nullable(),
  subject: AdminQueueJobSubjectSchema,
})

export const AdminQueueJobListResponseSchema = z.object({
  state: AdminQueueJobStateSchema,
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  // .min(1) rather than .positive() — Fastify OpenAPI serialization rejects
  // zod-to-json-schema's boolean-style exclusiveMinimum from .positive().
  limit: z.number().int().min(1),
  jobs: z.array(AdminQueueJobSchema),
})

export type AdminQueueJobListResponse = z.infer<typeof AdminQueueJobListResponseSchema>
