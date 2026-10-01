// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SubscribedCollectionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  type: z.string(),
  coverUrl: z.string().nullable(),
  itemCount: z.number().int(),
  ownerUsername: z.string(),
  ownerDisplayName: z.string(),
  subscribedAt: z.string().datetime(),
})

export const MeCollectionSubscriptionsResponseSchema = z.object({
  items: z.array(SubscribedCollectionSchema),
})

export type SubscribedCollection = z.infer<typeof SubscribedCollectionSchema>
