// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateJamSessionSchema = z.object({
  collectionSlug: z.string().min(1),
})
export type CreateJamSessionInput = z.infer<typeof CreateJamSessionSchema>

export const JamParticipantRoleSchema = z.enum(['HOST', 'GUEST'])

export const JamParticipantViewSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: JamParticipantRoleSchema,
  canControl: z.boolean(),
  joinedAt: z.coerce.date(),
})
export type JamParticipantView = z.infer<typeof JamParticipantViewSchema>

/** A lightweight snapshot of the currently-playing track — the host already
 * has the full track in hand, so it sends just enough for a guest to render
 * "now playing" without a second lookup. */
export const JamTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  coverUrl: z.string().nullable(),
})
export type JamTrack = z.infer<typeof JamTrackSchema>

export const JamSessionViewSchema = z.object({
  id: z.string(),
  code: z.string(),
  hostUserId: z.string(),
  collectionId: z.string().nullable(),
  isPlaying: z.boolean(),
  currentTrack: JamTrackSchema.nullable(),
  positionSec: z.number(),
  positionUpdatedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  participants: z.array(JamParticipantViewSchema),
})
export type JamSessionView = z.infer<typeof JamSessionViewSchema>

/** The host's client sends this as it plays — every few seconds and on any
 * transport change (play/pause/seek/track change). Everything else in the
 * session is derived from the most recent one of these. */
export const JamStateUpdateSchema = z.object({
  isPlaying: z.boolean(),
  currentTrack: JamTrackSchema.nullable(),
  positionSec: z.number().min(0),
})
export type JamStateUpdateInput = z.infer<typeof JamStateUpdateSchema>

/** Envelope for every message on the `/api/v1/jam/:id/events` SSE stream. */
export const JamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), session: JamSessionViewSchema }),
  z.object({ type: z.literal('ended') }),
])
export type JamEvent = z.infer<typeof JamEventSchema>
