// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { LikedPlaylistResponseSchema, LikedTrackSchema } from './responses/engagement.js'

export const MeLikesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const MeLikesResponseSchema = z.object({
  items: z.array(LikedTrackSchema),
})

export type LikedTrack = z.infer<typeof LikedTrackSchema>
export type LikedPlaylistResponse = z.infer<typeof LikedPlaylistResponseSchema>
