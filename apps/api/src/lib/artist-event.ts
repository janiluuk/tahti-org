// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { safeDisplayName } from '@tahti/shared'

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
  timezone: string | null
  visibility: 'PUBLIC' | 'FANS'
  venue?: { id: string; slug: string; name: string; city: string } | null
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
  publishedAt: Date | null
}

export type ArtistEventParticipantRow = {
  role: 'PERFORMER' | 'HOST' | 'GUEST'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  user: {
    username: string
    displayName: string | null
    avatarUrl: string | null
    channel: { slug: string } | null
  }
}

// What every event read selects for its participants.
export const participantInclude = {
  venue: { select: { id: true, slug: true, name: true, city: true } },
  participants: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      role: true,
      status: true,
      user: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          channel: { select: { slug: true } },
        },
      },
    },
  },
}

export function serializeArtistEvent(
  event: ArtistEventRow & { participants?: ArtistEventParticipantRow[] },
  options: { acceptedOnly?: boolean } = { acceptedOnly: true },
) {
  const participants = (event.participants ?? [])
    .filter((p) => !options.acceptedOnly || p.status === 'ACCEPTED')
    .map((p) => ({
      username: p.user.username,
      displayName: safeDisplayName(p.user.displayName, p.user.username),
      avatarUrl: p.user.avatarUrl,
      channelSlug: p.user.channel?.slug ?? null,
      role: p.role,
      status: p.status,
    }))
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
    timezone: event.timezone,
    venue: event.venue ?? null,
    visibility: event.visibility,
    status: event.status,
    publishedAt: event.publishedAt ? event.publishedAt.toISOString() : null,
    participants,
  }
}

// Events listeners may see: published ones, and cancelled ones so a
// cancellation stays visible instead of the event silently disappearing.
export const PUBLIC_EVENT_STATUSES = ['PUBLISHED', 'CANCELLED'] as const

const FAN_SUB_CANCEL_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export function eventVisibilityWhere(viewerId: string | null | undefined, now = new Date()) {
  if (!viewerId) return { visibility: 'PUBLIC' as const }
  return {
    OR: [
      { visibility: 'PUBLIC' as const },
      { userId: viewerId },
      { participants: { some: { userId: viewerId, status: 'ACCEPTED' as const } } },
      {
        user: {
          fanSubsAsArtist: {
            some: {
              subscriberUserId: viewerId,
              OR: [
                { state: 'ACTIVE' as const, currentPeriodEnd: { gt: now } },
                {
                  state: 'CANCELED' as const,
                  currentPeriodEnd: { gt: new Date(now.getTime() - FAN_SUB_CANCEL_GRACE_MS) },
                },
              ],
            },
          },
        },
      },
    ],
  }
}

type TagNotifierPrisma = {
  artistEventParticipant: {
    findMany: (args: {
      where: { eventId: string; status: 'PENDING'; userId?: { in: string[] } }
      select: { userId: true }
    }) => Promise<Array<{ userId: string }>>
  }
  notification: {
    createMany: (args: {
      data: Array<{
        userId: string
        type: 'EVENT_TAGGED'
        actorUserId: string
        title: string
        body: string
        url: string
      }>
    }) => Promise<unknown>
  }
}

// Tell tagged people about a published event; `onlyUserIds` limits it to
// people just added to an event that was already public.
export async function notifyTaggedParticipants(
  prisma: TagNotifierPrisma,
  host: { id: string; username: string; displayName: string | null },
  event: { id: string; title: string; place: string; location: string },
  onlyUserIds?: string[],
) {
  const pending = await prisma.artistEventParticipant.findMany({
    where: {
      eventId: event.id,
      status: 'PENDING',
      ...(onlyUserIds ? { userId: { in: onlyUserIds } } : {}),
    },
    select: { userId: true },
  })
  if (pending.length === 0) return
  const name = safeDisplayName(host.displayName, host.username)
  await prisma.notification.createMany({
    data: pending.map((p) => ({
      userId: p.userId,
      type: 'EVENT_TAGGED' as const,
      actorUserId: host.id,
      title: `${name} tagged you on an event`,
      body: `${event.title} · ${event.place}, ${event.location}`,
      url: '/studio/events?tab=invites',
    })),
  })
}
