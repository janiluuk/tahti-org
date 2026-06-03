// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import type { AdminVenueRow } from './actions'
import { unverifyVenue, verifyVenue } from './actions'

export default function VenueAdminPanel({ initial }: { initial: AdminVenueRow[] }) {
  const [venues, setVenues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(slug: string, verified: boolean) {
    setError(null)
    startTransition(async () => {
      const res = verified ? await unverifyVenue(slug) : await verifyVenue(slug)
      if (res.error) {
        setError(res.error)
        return
      }
      setVenues((list) =>
        list.map((v) =>
          v.slug === slug ? { ...v, verifiedAt: verified ? null : new Date().toISOString() } : v,
        ),
      )
    })
  }

  if (venues.length === 0) {
    return <p style={{ color: '#666' }}>No venue listings yet.</p>
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem 0' }}>Venue</th>
            <th>Location</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => {
            const verified = Boolean(v.verifiedAt)
            return (
              <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.6rem 0' }}>
                  <strong>{v.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{v.slug}</div>
                </td>
                <td>{[v.city, v.countryCode].filter(Boolean).join(', ') || '—'}</td>
                <td>{verified ? 'Verified' : 'Pending'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggle(v.slug, verified)}
                    style={{
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    {verified ? 'Unverify' : 'Verify'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p style={{ color: '#dc2626', marginTop: '0.75rem' }}>{error}</p>}
    </div>
  )
}
