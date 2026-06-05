// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Alert, Button, Text } from '@tahti/ui'
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
    return (
      <Text tone="muted" size="sm">
        No venue listings yet.
      </Text>
    )
  }

  return (
    <div>
      <div className="brand-table-wrap">
        <table className="brand-table">
          <thead>
            <tr>
              <th>Venue</th>
              <th>Location</th>
              <th>Status</th>
              <th className="align-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => {
              const verified = Boolean(v.verifiedAt)
              return (
                <tr key={v.id}>
                  <td>
                    <strong>{v.name}</strong>
                    <div className="sub">{v.slug}</div>
                  </td>
                  <td>{[v.city, v.countryCode].filter(Boolean).join(', ') || '—'}</td>
                  <td>{verified ? 'Verified' : 'Pending'}</td>
                  <td className="align-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => toggle(v.slug, verified)}
                    >
                      {verified ? 'Unverify' : 'Verify'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  )
}
