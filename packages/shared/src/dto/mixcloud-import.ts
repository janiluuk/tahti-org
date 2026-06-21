// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MixcloudTrackResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  username: z.string(),
  displayName: z.string(),
  durationSec: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
})

export const MixcloudSearchResponseSchema = z.object({
  tracks: z.array(MixcloudTrackResultSchema),
})

export const MixcloudMeTracksResponseSchema = z.object({
  username: z.string().nullable(),
  tracks: z.array(MixcloudTrackResultSchema),
})

export const MixcloudByUsernameQuerySchema = z.object({
  profileUrl: z.string().min(1),
})

export const MixcloudAddTrackRequestSchema = z.object({
  collectionId: z.string().min(1),
  cloudcastUrl: z
    .string()
    .regex(
      /^https:\/\/(www\.)?mixcloud\.com\/[^/]+\/[^/]+\/?$/,
      'Expected a mixcloud.com cloudcast URL',
    ),
})

export const MixcloudAddTrackResponseSchema = z.object({
  archiveItemId: z.string(),
  collectionItemId: z.string(),
  track: MixcloudTrackResultSchema,
})
