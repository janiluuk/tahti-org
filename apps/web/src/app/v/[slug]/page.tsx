// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Heading, Link, Stack, Text } from '@tahti/ui'

export const revalidate = 300

interface VenueBroadcast {
  id: string
  startAt: string
  endAt: string | null
  description: string | null
  state: string
}

interface VenueProfile {
  id: string
  slug: string
  name: string
  address: string
  city: string
  countryCode: string
  capacity: number | null
  description: string | null
  broadcasts: VenueBroadcast[]
}

async function fetchVenue(slug: string): Promise<VenueProfile | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/venues/${encodeURIComponent(slug)}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return (await res.json()) as VenueProfile
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const venue = await fetchVenue(params.slug)
  if (!venue) return { title: 'Venue not found' }
  return {
    title: `${venue.name} — Tahti venues`,
    description: venue.description ?? `Upcoming broadcasts at ${venue.name}.`,
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default async function VenueProfilePage({ params }: { params: { slug: string } }) {
  const venue = await fetchVenue(params.slug)
  if (!venue) notFound()

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const calendarUrl = `${apiUrl}/api/v1/venues/${encodeURIComponent(venue.slug)}/calendar.ics`

  return (
    <Stack gap={6} className="brand-section">
      <div>
        <Text size="sm">
          <Link href="/venues">← All venues</Link>
        </Text>
        <Heading level={1}>{venue.name}</Heading>
        <Text tone="muted">
          {venue.address}, {venue.city}
          {venue.countryCode ? ` (${venue.countryCode})` : ''}
        </Text>
        {venue.capacity ? <Text tone="muted">Capacity: {venue.capacity}</Text> : null}
        {venue.description ? <Text>{venue.description}</Text> : null}
        <Text size="sm">
          <a href={calendarUrl} className="ui-link">
            Download calendar (.ics)
          </a>
        </Text>
      </div>

      <section>
        <Heading level={2}>Upcoming broadcasts</Heading>
        {venue.broadcasts.length === 0 ? (
          <Text tone="muted">No upcoming broadcasts scheduled.</Text>
        ) : (
          <ul className="brand-section">
            {venue.broadcasts.map((b) => (
              <li key={b.id} className="brand-card">
                <Text>
                  <strong>{formatWhen(b.startAt)}</strong>
                  {b.endAt ? ` — ${formatWhen(b.endAt)}` : null}
                </Text>
                {b.description ? <Text tone="muted">{b.description}</Text> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Stack>
  )
}
