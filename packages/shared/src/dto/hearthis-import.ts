// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const HearthisTrackResultSchema = z.object({
  /** Numeric hearthis.at track id — required for the widget embed src (hearthis has no URL-based embed). */
  id: z.string(),
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

export type HearthisTrackResult = z.infer<typeof HearthisTrackResultSchema>

/** Richer track row for discography / set inspection (download flags for future CLI import). */
export const HearthisSetTrackResultSchema = HearthisTrackResultSchema.extend({
  // Use min(1) rather than positive() — Fastify OpenAPI serialization rejects
  // Zod's exclusiveMinimum boolean form for integers.
  position: z.number().int().min(1),
  kind: z.string().nullable(),
  releaseDate: z.string().nullable(),
  downloadable: z.boolean(),
  downloadUrl: z.string().nullable(),
  downloadFilename: z.string().nullable(),
})

export type HearthisSetTrackResult = z.infer<typeof HearthisSetTrackResultSchema>

export const HearthisSetResultSchema = z.object({
  id: z.string(),
  permalink: z.string(),
  /** Canonical web URL: https://hearthis.at/set/{permalink}/ */
  url: z.string(),
  title: z.string(),
  description: z.string(),
  trackCount: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
  username: z.string(),
  userPermalink: z.string(),
  /** Year when hearthis.at exposes a usable date; often null for playlists. */
  year: z.number().int().nullable(),
})

export type HearthisSetResult = z.infer<typeof HearthisSetResultSchema>

export const HearthisSearchResponseSchema = z.object({
  tracks: z.array(HearthisTrackResultSchema),
})

export const HearthisUserTracksResponseSchema = z.object({
  username: z.string().nullable(),
  tracks: z.array(HearthisTrackResultSchema),
})

export const HearthisUserSetsResponseSchema = z.object({
  username: z.string().nullable(),
  sets: z.array(HearthisSetResultSchema),
})

export const HearthisSetTracksResponseSchema = z.object({
  permalink: z.string(),
  url: z.string(),
  /** Playlist metadata when resolvable from the owner's Sets list; null if unknown. */
  set: HearthisSetResultSchema.nullable(),
  tracks: z.array(HearthisSetTrackResultSchema),
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
  soundId: z.string(),
  collectionItemId: z.string(),
  track: HearthisTrackResultSchema,
})
