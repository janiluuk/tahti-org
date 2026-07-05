// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Generic presigned image upload — reused for archive banner and collection cover art. */
export const ImageUploadPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export const ImageUploadCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
})

export const ImageUploadPrepareResponseSchema = z.object({
  uploadKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})

export const ImageUploadCompleteResponseSchema = z.object({
  url: z.string().nullable(),
})

/** Server fetches an artist-supplied URL and rehosts it, same attach semantics as an upload. */
export const ImageFromUrlSchema = z.object({
  sourceUrl: z.string().url().max(2000),
})
