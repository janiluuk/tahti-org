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

export const ReleaseArtworkPrepareResponseSchema = z.object({
  uploadKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})

export const ReleaseArtworkCompleteResponseSchema = z.object({
  artworkUrl: z.string().nullable(),
  artworkKey: z.string().nullable(),
})
