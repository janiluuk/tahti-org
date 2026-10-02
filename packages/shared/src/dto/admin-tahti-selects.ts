// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminTahtiSelectsRotationItemSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  addedAt: z.string().datetime(),
  addedBy: z.string(),
  soundId: z.string(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  license: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  audioUrl: z.string().nullable(),
})

export const AdminTahtiSelectsRotationResponseSchema = z.object({
  items: z.array(AdminTahtiSelectsRotationItemSchema),
})

export const AdminTahtiSelectsBrowseItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  license: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  audioUrl: z.string().nullable(),
})

export const AdminTahtiSelectsBrowseResponseSchema = z.object({
  items: z.array(AdminTahtiSelectsBrowseItemSchema),
})
