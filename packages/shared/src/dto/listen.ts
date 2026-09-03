// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Where a listen heartbeat originated — the "from where" half of listen
 * tracking (the other half, geographic origin, comes from IP → country,
 * same as Download.countryCode). */
export const LISTEN_SOURCES = [
  'CHANNEL_PAGE',
  'TAHTI_RADIO',
  'ARTIST_PROFILE',
  'DISCOVER',
  'LIBRARY',
  'EMBED',
  'OTHER',
] as const

export const ListenSourceSchema = z.enum(LISTEN_SOURCES)

/** POST /api/v1/listen/heartbeat body — client pings this once a minute
 * ("still listening") while actively playing. No duration is self-reported:
 * a ping either extends the caller's current open ListenSession or opens a
 * new one; a server cron closes sessions that stop pinging, so "minutes
 * listened" is always a plain (endedAt - startedAt) computed server-side.
 * `soundId` identifies an on-demand track (the server resolves its
 * channel); `channelSlug` identifies a live stream directly. At least one
 * is required. */
export const ListenHeartbeatBodySchema = z
  .object({
    channelSlug: z.string().min(1).max(64).optional(),
    soundId: z.string().optional(),
    source: ListenSourceSchema,
    fp: z.string().max(128).optional(),
  })
  .refine((body) => Boolean(body.channelSlug || body.soundId), {
    message: 'channelSlug or soundId is required',
  })

export type ListenHeartbeatBody = z.infer<typeof ListenHeartbeatBodySchema>
