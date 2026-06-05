// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const PressKitReleaseSchema = z.object({
  title: z.string(),
  type: z.string(),
  releaseDate: z.coerce.date(),
  smartLinkSlug: z.string(),
  smartLinkUrl: z.string(),
  artworkUrl: z.string().nullable(),
  description: z.string().nullable(),
})

export const PressKitSchema = z.object({
  generatedAt: z.coerce.date(),
  displayName: z.string(),
  username: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  email: z.string().optional(),
  socialLinks: z.record(z.unknown()).nullable(),
  tipJarUrl: z.string().nullable(),
  profileUrl: z.string(),
  channelUrl: z.string().nullable(),
  channelSlug: z.string().nullable(),
  releases: z.array(PressKitReleaseSchema),
})

export const AccountDeletionRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export const AccountDeletionResponseSchema = z.object({
  ok: z.literal(true),
  ticketId: z.string(),
})
