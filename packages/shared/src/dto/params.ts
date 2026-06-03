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

export function parseRouteParams<T extends z.ZodTypeAny>(
  schema: T,
  params: unknown,
): z.infer<T> | null {
  const parsed = schema.safeParse(params)
  return parsed.success ? parsed.data : null
}
