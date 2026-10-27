// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MikseriAddTrackRequestSchema = z.object({
  collectionId: z.string().min(1),
  trackUrl: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(200),
  genre: z.string().trim().max(100).optional(),
  rightsConfirmed: z.literal(true),
})

export const MikseriAddTrackResponseSchema = z.object({
  soundId: z.string(),
  collectionItemId: z.string(),
  embedUrl: z.string().url(),
})
