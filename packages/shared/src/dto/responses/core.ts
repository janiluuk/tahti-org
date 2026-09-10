// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ApiStatusResponseSchema = z.object({
  status: z.enum(['operational', 'degraded', 'outage']),
  version: z.string(),
  uptimeSec: z.number().int().nonnegative(),
  checks: z.record(
    z.object({
      state: z.string(),
      critical: z.boolean(),
      latencyMs: z.number().optional(),
      detail: z.string().optional(),
    }),
  ),
  ts: z.string().datetime(),
})

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  db: z.enum(['ok', 'error']),
  checks: z.record(z.string()),
  uptime: z.number().int().nonnegative(),
  ts: z.string().datetime(),
})

export const CsvExportBodySchema = z.string()

export const PrometheusMetricsBodySchema = z.string()

export const FallbackM3uBodySchema = z.string()

export const PlainTextErrorSchema = z.string()
