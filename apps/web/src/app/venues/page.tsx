// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'

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
    <div className="listen-shell">
      <header className="listen-page-header">
        <h1 className="listen-page-title">Venues</h1>
        <p className="listen-page-sub">
          Cultural venues and spaces that host Tahti live broadcasts.
        </p>
        <div className="listen-header__meta">
          <Link href="/venues/register" className="listen-radio-link">
            Register a venue →
          </Link>
        </div>
      </header>

      {venues.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No verified venues yet.</p>
          <p className="public-empty-card__hint">
            <Link href="/venues/register">Submit your venue</Link> for board verification.
          </p>
        </div>
      ) : (
        <section className="listen-section">
          <div className="listen-section__label">Verified venues</div>
          <ul className="listen-grid">
            {venues.map((venue) => (
              <li key={venue.id}>
                <Link href={`/v/${venue.slug}`} className="listen-card">
                  <div className="listen-card__avatar">
                    <span className="listen-card__avatar-fallback" aria-hidden>
                      {venue.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="listen-card__body">
                    <div className="listen-card__name">{venue.name}</div>
                    <div className="listen-card__handle">
                      {venue.city}
                      {venue.countryCode ? `, ${venue.countryCode}` : ''}
                      {venue.capacity ? ` · ${venue.capacity} cap.` : ''}
                    </div>
                    {venue.description ? (
                      <p className="listen-card__status listen-card__status--muted">
                        {venue.description.slice(0, 120)}
                        {venue.description.length > 120 ? '…' : ''}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
