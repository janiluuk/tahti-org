// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import TierCards from './tier-cards'

interface TiersResponse {
  artist: {
    id: string
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
  }
  tiers: Array<{
    id: string
    name: string
    amountCents: number
    description: string | null
    perks: string[]
  }>
  paymentsReady: boolean
}

export default async function SubscribePage({ params }: { params: { username: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let data: TiersResponse
  try {
    const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(params.username)}/tiers`, {
      cache: 'no-store',
    })
    if (!res.ok) notFound()
    data = (await res.json()) as TiersResponse
  } catch {
    notFound()
  }

  return (
    <div
      style={{
        maxWidth: 760,
        margin: '3rem auto',
        padding: '0 1rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <a href={`/c/${data.artist.username}`} style={{ color: '#888', fontSize: '0.85rem' }}>
        ← {data.artist.displayName}
      </a>
      <h1 style={{ margin: '0.5rem 0 0.25rem' }}>Support {data.artist.displayName}</h1>
      {data.artist.bio && <p style={{ color: '#666', marginBottom: '2rem' }}>{data.artist.bio}</p>}

      {data.tiers.length === 0 ? (
        <p style={{ color: '#999' }}>This artist hasn&apos;t set up fan subscriptions yet.</p>
      ) : (
        <TierCards
          username={data.artist.username}
          tiers={data.tiers}
          paymentsReady={data.paymentsReady}
        />
      )}
    </div>
  )
}
