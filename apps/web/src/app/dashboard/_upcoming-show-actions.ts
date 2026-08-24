// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { RadioSlotBookingItem, ScheduledLiveShowView } from '@tahti/shared'
import { RADIO_SLOT_MAX_ADVANCE_DAYS } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export type UpcomingShow = {
  source: 'radio' | 'own'
  title: string
  startAt: string
  href: string
}

/** Soonest future show the current user is booked into, whichever comes
 * first between a Tahti Radio slot and their own channel's schedule — the
 * top-nav notice only has room for one, so this picks the winner instead of
 * threading both sources down as separate props. */
export async function fetchNextUpcomingShow(): Promise<UpcomingShow | null> {
  const now = new Date()
  const to = new Date(now.getTime() + (RADIO_SLOT_MAX_ADVANCE_DAYS + 1) * 24 * 60 * 60 * 1000)

  const [radioRes, ownRes] = await Promise.all([
    fetch(
      `${apiUrl}/api/me/radio-slot-bookings?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { headers: { Cookie: sessionHeader() }, cache: 'no-store' },
    ),
    fetch(`${apiUrl}/api/me/channel/show-series`, {
      headers: { Cookie: sessionHeader() },
      cache: 'no-store',
    }),
  ])

  let nextRadio: UpcomingShow | null = null
  if (radioRes.ok) {
    const bookings = (await radioRes.json()) as RadioSlotBookingItem[]
    // Already ordered by startAt asc server-side — first isMine match is soonest.
    const mine = bookings.find((b) => b.isMine)
    if (mine) {
      nextRadio = {
        source: 'radio',
        title: mine.note || (mine.showType === 'TALK' ? 'Talk show' : 'Live set'),
        startAt: mine.startAt,
        href: '/dashboard/tahti-radio-slots',
      }
    }
  }

  let nextOwn: UpcomingShow | null = null
  if (ownRes.ok) {
    const data = (await ownRes.json()) as { scheduledShows: ScheduledLiveShowView[] }
    // Route already filters to future + non-canceled and sorts by startAt asc.
    const show = data.scheduledShows[0]
    if (show) {
      nextOwn = {
        source: 'own',
        title: show.title,
        startAt: show.startAt,
        href: '/dashboard/schedule',
      }
    }
  }

  if (nextRadio && nextOwn) {
    return new Date(nextRadio.startAt) <= new Date(nextOwn.startAt) ? nextRadio : nextOwn
  }
  return nextRadio ?? nextOwn ?? null
}
