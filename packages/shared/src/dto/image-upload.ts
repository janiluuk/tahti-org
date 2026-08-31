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

/** Generic "my media" upload complete — unlike ImageUploadCompleteSchema (which just
 * confirms a key already tied to a specific record), this has no owning record to
 * read metadata back from, so the client resends what it already knows about the file. */
export const UserMediaCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
})

export const UserMediaFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  url: z.string(),
  createdAt: z.string().datetime(),
})

/** Channel header backdrop upload — the one upload surface where the same
 * slot accepts either a static image or a short video loop (matching the
 * client's HEADER_MEDIA_TYPES allowlist), unlike every other image-only
 * upload pair above. */
export const ChannelBackdropUploadPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([
    'video/mp4',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
})

export const ChannelBackdropUploadCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
})

export const ChannelBackdropUploadCompleteResponseSchema = z.object({
  videoBackgroundUrl: z.string(),
})
