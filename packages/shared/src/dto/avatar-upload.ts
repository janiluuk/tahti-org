// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AvatarUploadPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
})

export const AvatarUploadCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
  /** Static first-frame JPEG upload key — set only when uploadKey is an
   * animated GIF, so the profile hero can show it at rest and swap to the
   * animated GIF on hover. Omit/clear when the new avatar isn't animated. */
  posterUploadKey: z.string().min(1).max(512).optional(),
})

export const AvatarUploadPrepareResponseSchema = z.object({
  uploadKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})

export const AvatarUploadCompleteResponseSchema = z.object({
  avatarUrl: z.string().nullable(),
  avatarPosterUrl: z.string().nullable().optional(),
})

export const AvatarProxyQuerySchema = z.object({
  url: z.string().url(),
})

/** Logo upload — PNG/WebP preferred so alpha is preserved for overlays. */
export const LogoUploadPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/webp']),
})

export const LogoUploadCompleteSchema = z.object({
  uploadKey: z.string().min(1).max(512),
})

export const LogoUploadCompleteResponseSchema = z.object({
  logoUrl: z.string().nullable(),
})
