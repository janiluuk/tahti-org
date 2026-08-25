// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ARCHIVE_CONTENT_TYPES } from './archive-metadata.js'

/** Board-wide archive browser — one compact row per track across all users. */
export const AdminFileRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  genre: z.string().nullable(),
  genreCustom: z.string().nullable(),
  contentType: z.enum(ARCHIVE_CONTENT_TYPES),
  status: z.string(),
  isPublic: z.boolean(),
  durationSec: z.number().int().nullable(),
  sizeBytes: z.number().nullable(),
  bannerUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  channelSlug: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
})

export type AdminFileRow = z.infer<typeof AdminFileRowSchema>

export const AdminFilesListResponseSchema = z.object({
  items: z.array(AdminFileRowSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
})

export type AdminFilesListResponse = z.infer<typeof AdminFilesListResponseSchema>

export const AdminFilesFacetsResponseSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      displayName: z.string(),
    }),
  ),
  genres: z.array(z.string()),
  contentTypes: z.array(z.enum(ARCHIVE_CONTENT_TYPES)),
})

export type AdminFilesFacetsResponse = z.infer<typeof AdminFilesFacetsResponseSchema>

export const AdminFilesBulkPatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  genre: z.string().max(80).nullable().optional(),
  genreCustom: z.string().max(80).nullable().optional(),
  contentType: z.enum(ARCHIVE_CONTENT_TYPES).optional(),
  isPublic: z.boolean().optional(),
  license: z
    .enum([
      'ALL_RIGHTS_RESERVED',
      'CC_BY',
      'CC_BY_NC',
      'CC_BY_NC_SA',
      'CC_BY_NC_ND',
      'CC_BY_SA',
      'CC0',
    ])
    .optional(),
})

export type AdminFilesBulkPatch = z.infer<typeof AdminFilesBulkPatchSchema>

export const AdminFilesBulkPatchResponseSchema = z.object({
  updated: z.number().int(),
})

export const AdminFileAudioResponseSchema = z.object({
  audioUrl: z.string().nullable(),
  title: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  bannerUrl: z.string().nullable(),
  durationSec: z.number().int().nullable(),
})
