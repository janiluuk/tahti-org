// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type ArtistEventRow = {
  id: string
  title: string
  description: string | null
  place: string
  location: string
  eventUrl: string | null
  ticketUrl: string | null
  imageUrl: string | null
  startAt: Date
  endAt: Date | null
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  publishedAt: Date | null
}

export function serializeArtistEvent(event: ArtistEventRow) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    place: event.place,
    location: event.location,
    eventUrl: event.eventUrl,
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    status: event.status,
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
  }
}

// Events listeners may see: published ones, and cancelled ones so a
// cancellation stays visible instead of the event silently disappearing.
export const PUBLIC_EVENT_STATUSES = ['PUBLISHED', 'CANCELLED'] as const
