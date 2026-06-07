// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SlugParamSchema = z.object({
  slug: z.string().min(1).max(64),
})

export const IdParamSchema = z.object({
  id: z.string().min(1).max(64),
})

export const UsernameParamSchema = z.object({
  username: z.string().min(1).max(32),
})

export const ChannelArchiveParamsSchema = z.object({
  slug: SlugParamSchema.shape.slug,
  itemId: IdParamSchema.shape.id,
})

export const ReleaseTrackDownloadParamsSchema = z.object({
  smartLinkSlug: z.string().min(1).max(64),
  trackId: IdParamSchema.shape.id,
})

export const SmartLinkSlugParamSchema = z.object({
  smartLinkSlug: z.string().min(1).max(64),
})

export const ReleaseTrackParamsSchema = z.object({
  id: IdParamSchema.shape.id,
  trackId: IdParamSchema.shape.id,
})

export const ReleaseIdTrackIdParamsSchema = z.object({
  releaseId: IdParamSchema.shape.id,
  trackId: IdParamSchema.shape.id,
})

export const ReleaseTrackVersionParamsSchema = ReleaseIdTrackIdParamsSchema.extend({
  versionId: IdParamSchema.shape.id,
})

export const ArchiveVersionParamsSchema = z.object({
  id: IdParamSchema.shape.id,
  versionId: IdParamSchema.shape.id,
})

export const ArchiveItemIdParamSchema = z.object({
  itemId: IdParamSchema.shape.id,
})

export const HandleParamSchema = z.object({
  handle: UsernameParamSchema.shape.username,
})

export const FingerprintHashParamSchema = z.object({
  fingerprintHash: z.string().min(16).max(64),
})

export const UserIdParamSchema = z.object({
  userId: IdParamSchema.shape.id,
})

export const ModerateChatBanParamsSchema = z.object({
  slug: SlugParamSchema.shape.slug,
  fingerprintHash: FingerprintHashParamSchema.shape.fingerprintHash,
})

export const TokenParamSchema = z.object({
  token: z.string().min(16).max(128),
})

export const DraftIdParamSchema = z.object({
  draftId: IdParamSchema.shape.id,
})

export const ChannelIdParamSchema = z.object({
  channelId: IdParamSchema.shape.id,
})

export function parseRouteParams<T extends z.ZodTypeAny>(
  schema: T,
  params: unknown,
): z.infer<T> | null {
  const parsed = schema.safeParse(params)
  return parsed.success ? parsed.data : null
}
