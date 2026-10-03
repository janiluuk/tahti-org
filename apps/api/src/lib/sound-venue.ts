// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const UNKNOWN_VENUE_BODY = { error: 'Unknown venue', code: 'unknown_venue' } as const

/**
 * Whether a track may be marked as recorded at this venue. An artist can pick
 * a verified venue or one they created (the same lists the studio picker
 * offers); the track's current venue stays allowed so re-saving other fields
 * never fails. `artistUserId: null` is a board edit, which may pick any venue.
 */
export async function canAttachVenue(
  prisma: PrismaClient,
  venueId: string,
  artistUserId: string | null,
  currentVenueId: string | null = null,
): Promise<boolean> {
  if (venueId === currentVenueId) return true
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { verifiedAt: true, createdBy: true },
  })
  if (!venue) return false
  if (artistUserId === null) return true
  return venue.verifiedAt !== null || venue.createdBy === artistUserId
}
