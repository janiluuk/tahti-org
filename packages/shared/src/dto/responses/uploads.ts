// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const PrepareUploadResponseSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string(),
  title: z.string(),
})

export const CompleteUploadResponseSchema = z.object({
  itemId: z.string(),
  status: z.string(),
})
