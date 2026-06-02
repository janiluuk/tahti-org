// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface MeResponse {
  id: string
  email: string
  username: string
  displayName: string
  tier: string
  emailVerifiedAt: string | null
  membership: { status: string; activatedAt: string | null } | null
  channel: { slug: string; state: string } | null
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')

  if (!sessionCookie) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let user: MeResponse
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!response.ok) {
      redirect('/login')
    }
    user = (await response.json()) as MeResponse
  } catch {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: '0.4rem 0.8rem',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </form>
      </div>

      <p style={{ color: '#555', marginTop: '0.5rem' }}>Welcome back, {user.displayName}</p>

      {user.channel && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 1rem' }}>Your channel</h2>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>URL:</strong> <code>{user.channel.slug}.tahti.fi</code>
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Status:</strong>{' '}
            <span style={{ color: user.channel.state === 'LIVE' ? '#16a34a' : '#888' }}>
              {user.channel.state === 'LIVE' ? 'Live' : 'Offline'}
            </span>
          </p>
        </section>
      )}

      <p style={{ marginTop: '2rem', color: '#999', fontSize: '0.9rem' }}>
        Broadcasting and archive features are coming in the next update.
      </p>
    </div>
  )
}
