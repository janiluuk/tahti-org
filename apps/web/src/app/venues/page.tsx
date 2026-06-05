// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading, Link as UiLink, Stack, Text } from '@tahti/ui'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Venues — Tahti',
  description: 'Verified venues hosting Tahti live broadcasts.',
}

interface VenueEntry {
  id: string
  slug: string
  name: string
  city: string
  countryCode: string | null
  capacity: number | null
  description: string | null
}

async function fetchVenues(): Promise<VenueEntry[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/venues`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    return (await res.json()) as VenueEntry[]
  } catch {
    return []
  }
}

export default async function VenuesDirectoryPage() {
  const venues = await fetchVenues()

  return (
    <Stack gap={6} className="brand-section">
      <div>
        <Text size="sm">
          <UiLink href="/">← Home</UiLink>
        </Text>
        <Heading level={1}>Venue directory</Heading>
        <Text tone="muted">
          Cultural venues and spaces that host Tahti live broadcasts. Subscribe to a venue calendar
          from its profile page.
        </Text>
        <Text size="sm">
          <Link href="/venues/register">Register a venue →</Link>
        </Text>
      </div>

      {venues.length === 0 ? (
        <Text tone="muted">No verified venues yet.</Text>
      ) : (
        <ul className="brand-section">
          {venues.map((venue) => (
            <li key={venue.id} className="brand-card">
              <Link href={`/v/${venue.slug}`}>
                <Heading level={3}>{venue.name}</Heading>
                <Text tone="muted">
                  {venue.city}
                  {venue.countryCode ? `, ${venue.countryCode}` : ''}
                  {venue.capacity ? ` · capacity ${venue.capacity}` : ''}
                </Text>
                {venue.description ? <Text>{venue.description.slice(0, 200)}</Text> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  )
}
