// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ReleaseTypeSchema } from './release.js'

export const ReleaseImportRowSchema = z.object({
  releaseTitle: z.string().trim().min(1).max(200),
  type: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    ReleaseTypeSchema.default('SINGLE'),
  ),
  releaseDate: z.coerce.date(),
  trackTitle: z.string().trim().min(1).max(200),
  isrc: z
    .string()
    .trim()
    .max(15)
    .optional()
    .transform((s) => (s === '' ? null : (s ?? null))),
  upc: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((s) => (s === '' ? null : (s ?? null))),
  description: z
    .string()
    .trim()
    .max(10_000)
    .optional()
    .transform((s) => (s === '' ? null : (s ?? null))),
})

export type ReleaseImportRow = z.infer<typeof ReleaseImportRowSchema>

export const ReleaseImportBodySchema = z.object({
  csv: z.string().trim().min(1).max(500_000),
})

export const ReleaseImportResultSchema = z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  releaseIds: z.array(z.string()),
  errors: z.array(z.string()),
})

export type ReleaseImportResult = z.infer<typeof ReleaseImportResultSchema>

export const AccountDeletionResultSchema = z.object({
  ok: z.literal(true),
  userId: z.string(),
  fanSubscriptionsCanceled: z.number().int().nonnegative(),
  newsletterSubscribersRemoved: z.number().int().nonnegative(),
})
