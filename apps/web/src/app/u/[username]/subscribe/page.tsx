// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { SafePlainText } from '@/components/safe-plain-text'
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
    <div style={{ maxWidth: 760 }}>
      <a
        href={`/u/${data.artist.username}`}
        className="brand-muted"
        style={{ fontSize: '0.85rem' }}
      >
        ← {data.artist.displayName}
      </a>
      <h1 style={{ margin: '0.5rem 0 0.25rem' }}>Support {data.artist.displayName}</h1>
      {data.artist.bio && (
        <SafePlainText
          text={data.artist.bio}
          className="brand-muted"
          style={{ marginBottom: '2rem', lineHeight: 1.6 }}
        />
      )}

      {data.tiers.length === 0 ? (
        <p className="brand-muted">This artist hasn&apos;t set up fan subscriptions yet.</p>
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
