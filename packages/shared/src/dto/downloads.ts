// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Public archive / release download query (`?fp=&format=`). */
export const DownloadFormatSchema = z.enum(['mp3_320', 'opus256', 'flac'])

export const ArchiveDownloadQuerySchema = z.object({
  fp: z.string().max(128).optional(),
  format: DownloadFormatSchema.optional(),
})

export const ReleaseDownloadQuerySchema = z.object({
  fp: z.string().max(128).optional(),
  format: DownloadFormatSchema.or(z.literal('source')).optional(),
})

export const DownloadGatesQuerySchema = z.object({
  fp: z.string().max(128).optional(),
})

export const RepostAckBodySchema = z.object({
  fp: z.string().max(128).optional(),
})

export const AuditExportQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
})
