// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SoundAudienceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
})

export const SoundAudiencePersonSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  /** When they liked / reposted it, or their latest play. */
  at: z.string(),
})

export const SoundAudienceListenerSchema = SoundAudiencePersonSchema.extend({
  plays: z.number().int(),
})

export const SoundAudienceCollectionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  ownerUsername: z.string(),
  ownerName: z.string(),
  itemCount: z.number().int(),
})

const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ total: z.number().int(), items: z.array(item) })

/** Public collections a sound is in, and the people who liked, reposted
 * and (signed in) played it. */
export const SoundAudienceResponseSchema = z.object({
  collections: page(SoundAudienceCollectionSchema),
  likes: page(SoundAudiencePersonSchema),
  reposts: page(SoundAudiencePersonSchema),
  plays: page(SoundAudienceListenerSchema),
})

export type SoundAudienceResponse = z.infer<typeof SoundAudienceResponseSchema>
export type SoundAudiencePerson = z.infer<typeof SoundAudiencePersonSchema>
