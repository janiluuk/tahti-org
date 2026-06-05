// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Heading, Link, Text } from '@tahti/ui'

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function VenueProfilePage({ params }: { params: { slug: string } }) {
  const venue = await fetchVenue(params.slug)
  if (!venue) notFound()

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const calendarUrl = `${apiUrl}/api/v1/venues/${encodeURIComponent(venue.slug)}/calendar.ics`

  const upcoming = venue.broadcasts.filter((b) => b.state !== 'ENDED')
  const past = venue.broadcasts.filter((b) => b.state === 'ENDED')

  return (
    <div className="brand-section">
      <Text size="sm">
        <Link href="/venues">← All venues</Link>
      </Text>

      <div className="venue-hero">
        <Heading level={1}>{venue.name}</Heading>
        <div className="venue-hero__meta">
          <span className="venue-hero__location">
            {venue.address}, {venue.city}
            {venue.countryCode ? ` · ${venue.countryCode}` : ''}
          </span>
          {venue.capacity ? (
            <span className="venue-hero__cap">Cap. {venue.capacity.toLocaleString()}</span>
          ) : null}
        </div>
        {venue.description ? (
          <Text tone="muted" className="venue-hero__desc">
            {venue.description}
          </Text>
        ) : null}
        <Text size="sm">
          <a href={calendarUrl} className="ui-link venue-hero__cal">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect
                x="1.5"
                y="2.5"
                width="13"
                height="12"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M5 1.5v2M11 1.5v2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Download calendar (.ics)
          </a>
        </Text>
      </div>

      <section className="brand-section">
        <Heading level={2}>Upcoming broadcasts</Heading>
        {upcoming.length === 0 ? (
          <Text tone="muted">No upcoming broadcasts scheduled.</Text>
        ) : (
          <ul className="venue-event-list">
            {upcoming.map((b) => (
              <li key={b.id} className="venue-event-card">
                <div className="venue-event-card__time">{formatDate(b.startAt)}</div>
                {b.endAt ? (
                  <div className="venue-event-card__end">ends {formatDate(b.endAt)}</div>
                ) : null}
                {b.description ? (
                  <div className="venue-event-card__desc">{b.description}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="brand-section">
          <Heading level={2}>Past broadcasts</Heading>
          <ul className="venue-event-list venue-event-list--past">
            {past.map((b) => (
              <li key={b.id} className="venue-event-card venue-event-card--past">
                <div className="venue-event-card__time">{formatDate(b.startAt)}</div>
                {b.description ? (
                  <div className="venue-event-card__desc">{b.description}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
