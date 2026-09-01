// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminWorkerSummarySchema = z.object({
  name: z.string(),
  lanes: z.array(z.string()),
  status: z.enum(['online', 'offline']),
  jobStatus: z.string().nullable(),
  hostname: z.string().nullable(),
  pid: z.number().int().nullable(),
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  lastJobName: z.string().nullable(),
  lastJobId: z.string().nullable(),
  lastJobStatus: z.string().nullable(),
  lastJobAt: z.string().datetime().nullable(),
})

export const AdminWorkerJobEventSchema = z.object({
  jobId: z.string(),
  jobName: z.string(),
  status: z.enum(['active', 'completed', 'failed']),
  at: z.string().datetime(),
  errorMessage: z.string().optional(),
})

export const AdminWorkersResponseSchema = z.object({
  workers: z.array(AdminWorkerSummarySchema),
})

export const AdminWorkerDetailResponseSchema = z.object({
  worker: AdminWorkerSummarySchema,
  history: z.array(AdminWorkerJobEventSchema),
})
