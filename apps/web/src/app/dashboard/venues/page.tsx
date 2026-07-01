// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ButtonIcon, Link, PageShell } from '@tahti/ui'
import { VenueManager } from './_venue-manager'

interface VenueBroadcast {
  id: string
  startAt: string
  endAt: string | null
  description: string | null
  channelId: string | null
  state: 'SCHEDULED' | 'LIVE' | 'CANCELED'
}

interface Venue {
  id: string
  slug: string
  name: string
  city: string
  countryCode: string
  capacity: number | null
  description: string | null
  address: string
  verifiedAt: string | null
  broadcasts: VenueBroadcast[]
}

export default async function VenuesDashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let venues: Venue[] = []
  try {
    const res = await fetch(`${apiUrl}/api/me/venues`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.status === 401) redirect('/login')
    if (res.ok) venues = (await res.json()) as Venue[]
  } catch {
    // show empty state
  }

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">My venues</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Manage your venue profiles and broadcast calendar.
          </p>
        </div>
        <div className="studio-page-header__actions">
          <Link href="/dashboard" className="ui-btn ui-btn--sm ui-btn--ghost">
            ← Dashboard
          </Link>
          <Link href="/venues/register" className="ui-btn ui-btn--sm ui-btn--primary">
            + Register new venue
          </Link>
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="studio-empty-card">
          <p className="studio-empty-card__text">No venues yet</p>
          <p className="studio-empty-card__hint">
            Register a venue to add it to the Tahti venue directory and publish your broadcast
            calendar. Venues are reviewed by the board before they appear publicly.
          </p>
          <Link href="/venues/register" className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm">
            <ButtonIcon name="plus" />
            Register a venue →
          </Link>
        </div>
      ) : (
        <VenueManager initialVenues={venues} />
      )}
    </PageShell>
  )
}
