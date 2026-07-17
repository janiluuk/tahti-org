// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Bookings snap to the hour; a single reservation covers at most this many hours. */
export const RADIO_SLOT_MAX_HOURS = 2
/** How far ahead an artist can reserve a slot, so no one can squat the whole calendar. */
export const RADIO_SLOT_MAX_ADVANCE_DAYS = 30
/** Cap on simultaneous upcoming reservations per channel — keeps the shared calendar fair. */
export const RADIO_SLOT_MAX_UPCOMING_PER_CHANNEL = 5

export const CreateRadioSlotBookingSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  note: z.string().trim().max(200).optional(),
})
export type CreateRadioSlotBookingInput = z.infer<typeof CreateRadioSlotBookingSchema>

export const RadioSlotBookingListQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})
export type RadioSlotBookingListQuery = z.infer<typeof RadioSlotBookingListQuerySchema>

export const RadioSlotBookingItemSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  note: z.string().nullable(),
  channelSlug: z.string(),
  displayName: z.string(),
  isMine: z.boolean(),
})
export type RadioSlotBookingItem = z.infer<typeof RadioSlotBookingItemSchema>

export const RadioSlotBookingListSchema = z.array(RadioSlotBookingItemSchema)
