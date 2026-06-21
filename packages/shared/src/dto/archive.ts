// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ArchiveUploadMetadataSchema } from './archive-metadata.js'

export const PrepareUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^audio\//),
  fileSizeBytes: z
    .number()
    .int()
    .min(1)
    .max(2 * 1024 * 1024 * 1024),
  title: z.string().min(1).max(200).trim(),
})

export type PrepareUploadInput = z.infer<typeof PrepareUploadSchema>

export const CompleteUploadSchema = z.object({
  uploadId: z.string().min(1),
  etag: z.string().min(1),
  title: z.string().min(1).max(200).trim(),
  metadata: ArchiveUploadMetadataSchema.optional(),
  // Mixed-source collections brief: lets the rescue-import flow (re-uploading your own
  // backup of a Mixcloud mix) tag the resulting item honestly. Never accepts embed sources —
  // those only ever come from the dedicated embed-add routes, not a file upload.
  source: z.enum(['UPLOAD', 'MIXCLOUD_RESCUE']).optional(),
})

export type CompleteUploadInput = z.infer<typeof CompleteUploadSchema>
