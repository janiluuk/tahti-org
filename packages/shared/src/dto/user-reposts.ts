// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const REPOSTED_TRACKS_LIMIT = 20

export const RepostedTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  bannerUrl: z.string().nullable(),
  channelSlug: z.string(),
  artistUsername: z.string(),
  artistDisplayName: z.string(),
  repostedAt: z.string().datetime(),
  url: z.string(),
})

export const UserRepostsResponseSchema = z.object({
  items: z.array(RepostedTrackSchema),
})

export type RepostedTrack = z.infer<typeof RepostedTrackSchema>
export type UserRepostsResponse = z.infer<typeof UserRepostsResponseSchema>
