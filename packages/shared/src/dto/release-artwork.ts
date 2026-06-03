// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ReleaseArtworkPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export const ReleaseArtworkCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
})
