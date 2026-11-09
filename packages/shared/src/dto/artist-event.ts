// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

const httpUrl = (field: string) =>
  z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: `${field} must be an http(s) URL` })

const ArtistEventFieldsSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => s || null),
  place: z.string().trim().min(1, 'place is required').max(160),
  location: z.string().trim().min(1, 'location is required').max(160),
  eventUrl: httpUrl('eventUrl'),
  ticketUrl: httpUrl('ticketUrl'),
  imageUrl: httpUrl('imageUrl'),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
})

const endsAfterStart = (body: { startAt?: string; endAt?: string | null }) =>
  !body.startAt || !body.endAt || new Date(body.endAt) > new Date(body.startAt)

export const ArtistEventStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED'])

export const CreateArtistEventSchema = ArtistEventFieldsSchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
}).refine(endsAfterStart, { message: 'endAt must be after startAt', path: ['endAt'] })

export type CreateArtistEventInput = z.infer<typeof CreateArtistEventSchema>

export const UpdateArtistEventSchema = ArtistEventFieldsSchema.partial()
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Nothing to update',
  })
  .refine(endsAfterStart, { message: 'endAt must be after startAt', path: ['endAt'] })

export type UpdateArtistEventInput = z.infer<typeof UpdateArtistEventSchema>

export const ArtistEventParticipantRoleSchema = z.enum(['PERFORMER', 'HOST', 'GUEST'])
export const ArtistEventParticipantStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED'])

export const ArtistEventParticipantSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  channelSlug: z.string().nullable(),
  role: ArtistEventParticipantRoleSchema,
  status: ArtistEventParticipantStatusSchema,
})

export type ArtistEventParticipantView = z.infer<typeof ArtistEventParticipantSchema>

export const SetArtistEventParticipantsSchema = z.object({
  participants: z
    .array(
      z.object({
        username: z.string().trim().min(1).max(64),
        role: ArtistEventParticipantRoleSchema.default('PERFORMER'),
      }),
    )
    .max(20),
})

export const ArtistEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  place: z.string(),
  location: z.string(),
  eventUrl: z.string().nullable(),
  ticketUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  status: ArtistEventStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  participants: z.array(ArtistEventParticipantSchema),
})

export type ArtistEventView = z.infer<typeof ArtistEventSchema>

export const ArtistEventListSchema = z.array(ArtistEventSchema)

export const EventCalendarQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    artist: z.string().trim().min(1).max(64).optional(),
  })
  .refine((q) => new Date(q.to) > new Date(q.from), { message: 'to must be after from' })
  .refine((q) => new Date(q.to).getTime() - new Date(q.from).getTime() <= 92 * 86_400_000, {
    message: 'range is at most 92 days',
  })

export const UpcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export const UpcomingEventSchema = ArtistEventSchema.extend({
  artistDisplayName: z.string(),
  artistUsername: z.string(),
  channelSlug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export type UpcomingEventView = z.infer<typeof UpcomingEventSchema>

export const UpcomingEventListSchema = z.array(UpcomingEventSchema)

export const ArtistEventIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export const ArtistEventInviteSchema = z.object({
  event: ArtistEventSchema,
  host: z.object({
    username: z.string(),
    displayName: z.string(),
    channelSlug: z.string().nullable(),
  }),
  role: ArtistEventParticipantRoleSchema,
  status: ArtistEventParticipantStatusSchema,
})

export const ArtistEventInviteListSchema = z.array(ArtistEventInviteSchema)
