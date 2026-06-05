// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MixcloudConnectStatusSchema = z.object({
  connected: z.boolean(),
  configured: z.boolean(),
})

export const MixcloudUploadQueuedSchema = z.object({
  mixUploadId: z.string(),
  status: z.literal('pending'),
})

export const MixcloudUploadStatusSchema = z.object({
  status: z.string(),
  mixcloudUrl: z.string().nullable(),
  error: z.string().nullable(),
  completedAt: z.coerce.date().nullable(),
})
