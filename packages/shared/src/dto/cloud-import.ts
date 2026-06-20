// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GoogleDriveConnectStatusSchema = z.object({
  connected: z.boolean(),
  configured: z.boolean(),
})

export const GoogleDrivePickerConfigSchema = z.object({
  clientId: z.string(),
  developerKey: z.string(),
  accessToken: z.string(),
})

export const GoogleDriveImportFileSchema = z.object({
  fileId: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().optional(),
})

export const GoogleDriveImportRequestSchema = z.object({
  files: z.array(GoogleDriveImportFileSchema).min(1).max(20),
})

export const GoogleDriveImportQueuedItemSchema = z.object({
  cloudImportJobId: z.string(),
  title: z.string(),
  status: z.literal('queued'),
})

export const GoogleDriveImportResponseSchema = z.object({
  imports: z.array(GoogleDriveImportQueuedItemSchema),
})

export const CloudImportJobStatusSchema = z.object({
  id: z.string(),
  source: z.string(),
  fileName: z.string().nullable(),
  status: z.string(),
  error: z.string().nullable(),
  archiveItemId: z.string().nullable(),
  bytesTransferred: z.coerce.number().nullable(),
  queuedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
})

export const CloudImportJobListSchema = z.object({
  jobs: z.array(CloudImportJobStatusSchema),
})
