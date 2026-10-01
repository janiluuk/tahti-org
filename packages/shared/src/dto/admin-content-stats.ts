// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Board content dashboard (Tahti Player /admin/content). */
export const AdminContentStatsSchema = z.object({
  counts: z.object({
    /** Sounds whose content type is TRACK. */
    tracks: z.number().int().nonnegative(),
    /** Live show series (radio shows). */
    shows: z.number().int().nonnegative(),
    /** Every uploaded or recorded sound, any content type. */
    uploads: z.number().int().nonnegative(),
    /** Counted listens across the catalog. */
    listens: z.number().int().nonnegative(),
  }),
  latestContent: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      artistName: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  latestBroadcasts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      artistName: z.string().nullable(),
      recordedAt: z.string(),
      durationSec: z.number().int().nonnegative().nullable(),
      soundId: z.string().nullable(),
    }),
  ),
})

export type AdminContentStats = z.infer<typeof AdminContentStatsSchema>
