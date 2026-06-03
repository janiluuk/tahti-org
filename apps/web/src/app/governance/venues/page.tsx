// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import VenueAdminPanel from './venue-admin-panel'
import { fetchAdminVenues } from './actions'

export default async function GovernanceVenuesPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  let isBoard = false
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) redirect('/login')
    const me = (await res.json()) as { isBoard: boolean }
    isBoard = me.isBoard
  } catch {
    redirect('/login')
  }

  if (!isBoard) {
    return (
      <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1rem' }}>
        <h1>Venue verification</h1>
        <p style={{ color: '#666' }}>Board access required.</p>
        <Link href="/governance">← Back to governance</Link>
      </div>
    )
  }

  const { venues, error } = await fetchAdminVenues()

  return (
    <div style={{ maxWidth: 900, margin: '3rem auto', padding: '0 1rem' }}>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link href="/governance">← Member governance</Link>
      </p>
      <h1 style={{ marginBottom: '0.25rem' }}>Venue verification</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Verified venues appear in the public directory. Unverified listings stay hidden until
        approved.
      </p>
      {error ? (
        <p style={{ color: '#dc2626' }}>{error}</p>
      ) : (
        <VenueAdminPanel initial={venues ?? []} />
      )}
    </div>
  )
}
