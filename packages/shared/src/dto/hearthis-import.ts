// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const HearthisTrackResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  username: z.string(),
  userPermalink: z.string(),
  durationSec: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
  genre: z.string().nullable(),
  /** hearthis.at's own playback URL — for in-app preview only, never stored/re-hosted. */
  streamUrl: z.string().nullable(),
})

export const HearthisSearchResponseSchema = z.object({
  tracks: z.array(HearthisTrackResultSchema),
})

export const HearthisUserTracksResponseSchema = z.object({
  username: z.string().nullable(),
  tracks: z.array(HearthisTrackResultSchema),
})

export const HearthisByUsernameQuerySchema = z.object({
  profileUrl: z.string().min(1),
})

export const HearthisAddTrackRequestSchema = z.object({
  collectionId: z.string().min(1),
  trackUrl: z
    .string()
    .regex(/^https:\/\/hearthis\.at\/[^/]+\/[^/]+\/?$/, 'Expected a hearthis.at track URL'),
})

export const HearthisAddTrackResponseSchema = z.object({
  archiveItemId: z.string(),
  collectionItemId: z.string(),
  track: HearthisTrackResultSchema,
})
