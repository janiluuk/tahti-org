// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { IdParamSchema } from './params.js'

export const LISTENING_PARTY_STATES = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELED'] as const
export const ListeningPartyStateSchema = z.enum(LISTENING_PARTY_STATES)

export const LISTENING_PARTY_HOST_NOTE_MAX = 2000
/** startAt must be at least this far in the future when set. */
export const LISTENING_PARTY_MIN_LEAD_MS = 5 * 60 * 1000
/** startAt may be at most this far in the future. */
export const LISTENING_PARTY_MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000
/** Upcoming parties listed on a channel page. */
export const CHANNEL_LISTENING_PARTIES_LIMIT = 10

const HostNoteSchema = z.string().trim().max(LISTENING_PARTY_HOST_NOTE_MAX)

export const CreateListeningPartyBodySchema = z.object({
  releaseId: IdParamSchema.shape.id,
  startAt: z.string().datetime({ offset: true }),
  /** Markdown. Blank stores null. */
  hostNote: HostNoteSchema.nullable()
    .optional()
    .transform((v) => (v ? v : null)),
})
export type CreateListeningPartyBody = z.infer<typeof CreateListeningPartyBodySchema>

export const UpdateListeningPartyBodySchema = z.object({
  startAt: z.string().datetime({ offset: true }).optional(),
  /** Markdown. Blank or null clears it; omitted leaves it as is. */
  hostNote: HostNoteSchema.nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
})
export type UpdateListeningPartyBody = z.infer<typeof UpdateListeningPartyBodySchema>

export const ListeningPartyTrackParamsSchema = z.object({
  id: IdParamSchema.shape.id,
  trackId: IdParamSchema.shape.id,
})

export const ListeningPartyCreditSchema = z.object({
  role: z.string(),
  name: z.string(),
  artistUsername: z.string().nullable().optional(),
})

export const ListeningPartyNowPlayingSchema = z.object({
  trackId: z.string(),
  position: z.number().int(),
  offsetSec: z.number(),
})

export const ListeningPartyPurchaseTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  priceOptional: z.boolean(),
  currency: z.string(),
})

export const ListeningPartyDtoSchema = z.object({
  id: z.string(),
  state: ListeningPartyStateSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  /** The server's clock when the response was built, for client clock offset. */
  serverNow: z.string().datetime(),
  hostNote: z.string().nullable(),
  channel: z.object({
    slug: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  host: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  release: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    artworkUrl: z.string().nullable(),
    smartLinkSlug: z.string().nullable(),
    releaseDate: z.string().datetime().nullable(),
    isPreRelease: z.boolean(),
    description: z.string().nullable(),
    /** Liner notes (Markdown). */
    commentary: z.string().nullable(),
    credits: z.array(ListeningPartyCreditSchema),
    pLine: z.string().nullable(),
    cLine: z.string().nullable(),
    labelImprint: z.string().nullable(),
  }),
  tracks: z.array(
    z.object({
      id: z.string(),
      position: z.number().int(),
      title: z.string(),
      durationSec: z.number(),
      credits: z.array(ListeningPartyCreditSchema),
    }),
  ),
  nowPlaying: ListeningPartyNowPlayingSchema.nullable(),
  purchaseTiers: z.array(ListeningPartyPurchaseTierSchema),
})
export type ListeningPartyDto = z.infer<typeof ListeningPartyDtoSchema>

export const ListeningPartySummaryDtoSchema = z.object({
  id: z.string(),
  state: ListeningPartyStateSchema,
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  release: z.object({
    id: z.string(),
    title: z.string(),
    artworkUrl: z.string().nullable(),
  }),
  channel: z.object({
    slug: z.string(),
    name: z.string(),
  }),
})
export type ListeningPartySummaryDto = z.infer<typeof ListeningPartySummaryDtoSchema>

export const ListeningPartySummaryListSchema = z.object({
  items: z.array(ListeningPartySummaryDtoSchema),
})
export type ListeningPartySummaryList = z.infer<typeof ListeningPartySummaryListSchema>
