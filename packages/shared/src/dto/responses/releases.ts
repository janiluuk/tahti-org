// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SmartLinkViewSchema = z.object({
  release: z.record(z.string(), z.unknown()),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  featuredCollections: z.array(z.record(z.string(), z.unknown())),
  profileUrl: z.string(),
  releaseUrl: z.string(),
  targets: z.record(z.string()),
  embedUrl: z.string(),
})

const meReleaseRow = z.object({ id: z.string(), title: z.string() }).passthrough()

export const MeReleaseListSchema = z.array(meReleaseRow)

// PERF-008: was a fully unbounded findMany. page/limit default to today's
// effective behavior (everything, up to a safety cap) rather than forcing a
// "load more" UI on a list that's realistically small per artist.
export const MeReleaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const MeReleasePagedListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  releases: MeReleaseListSchema,
})

export const MeReleaseDetailSchema = meReleaseRow

export const ReleaseChecklistStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  hint: z.string().optional(),
})

export const ReleaseCatalogViewSchema = z
  .object({
    id: z.string(),
    checklist: z.array(ReleaseChecklistStepSchema),
  })
  .passthrough()

export const ReleaseTrackViewSchema = z
  .object({
    id: z.string(),
    releaseId: z.string(),
    position: z.number().int(),
    title: z.string(),
    status: z.string(),
  })
  .passthrough()

export const ReleaseTrackUploadUrlSchema = z.object({
  uploadUrl: z.string().url(),
  sourceKey: z.string(),
  expiresAt: z.string(),
})

export const ReleaseTrackFinalizeSchema = z.object({
  trackId: z.string(),
  status: z.literal('scanning'),
})

export const ReleaseTrackDownloadUrlSchema = z.object({
  url: z.string().url(),
  format: z.enum(['flac', 'opus']),
  expiresInSec: z.number().int(),
})
