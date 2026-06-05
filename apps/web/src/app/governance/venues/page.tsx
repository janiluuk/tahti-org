// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, Link, Text } from '@tahti/ui'
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
        <Heading level={1}>Venue verification</Heading>
        <Text tone="muted">Board access required.</Text>
        <Text>
          <Link href="/governance">← Back to governance</Link>
        </Text>
      </>
    )
  }

  const { venues, error } = await fetchAdminVenues()

  return (
    <>
      <Text size="sm">
        <Link href="/governance">← Member governance</Link>
      </Text>
      <Heading level={1}>Venue verification</Heading>
      <Text tone="muted">
        Verified venues appear in the public directory. Unverified listings stay hidden until
        approved.
      </Text>
      {error ? <Text tone="error">{error}</Text> : <VenueAdminPanel initial={venues ?? []} />}
    </>
  )
}
