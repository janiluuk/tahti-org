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
      <>
        <h1>Venue verification</h1>
        <p className="brand-muted">Board access required.</p>
        <Link href="/governance">← Back to governance</Link>
      </>
    )
  }

  const { venues, error } = await fetchAdminVenues()

  return (
    <>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link href="/governance">← Member governance</Link>
      </p>
      <h1 style={{ marginBottom: '0.25rem' }}>Venue verification</h1>
      <p className="brand-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Verified venues appear in the public directory. Unverified listings stay hidden until
        approved.
      </p>
      {error ? (
        <p style={{ color: '#dc2626' }}>{error}</p>
      ) : (
        <VenueAdminPanel initial={venues ?? []} />
      )}
    </>
  )
}
