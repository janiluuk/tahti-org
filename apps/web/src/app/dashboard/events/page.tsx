// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ArtistEventView } from '@tahti/shared'
import { EventsManager } from './_events-manager'

async function fetchMyEvents(): Promise<ArtistEventView[]> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/me/events`, {
      headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return (await res.json()) as ArtistEventView[]
  } catch {
    return []
  }
}

export default async function EventsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/dashboard/events')

  const events = await fetchMyEvents()

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Events</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Upcoming shows you&apos;re playing — shown on your public profile.
          </p>
        </div>
      </div>
      <EventsManager initialEvents={events} />
    </div>
  )
}
