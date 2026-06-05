// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfilePageLayout } from '@/components/profile/profile-page-layout'
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
    <ProfilePageLayout
      narrow
      hero={
        <>
          <Link href={`/u/${data.artist.username}`} className="prof-back-link">
            ← {data.artist.displayName}
          </Link>
          <h1 className="prof-page-title">Support {data.artist.displayName}</h1>
          {data.artist.bio && (
            <SafePlainText
              text={data.artist.bio}
              className="prof-list-meta"
              style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}
            />
          )}
        </>
      }
    >
      {data.tiers.length === 0 ? (
        <p className="prof-list-meta">This artist hasn&apos;t set up fan subscriptions yet.</p>
      ) : (
        <TierCards
          username={data.artist.username}
          tiers={data.tiers}
          paymentsReady={data.paymentsReady}
        />
      )}
    </ProfilePageLayout>
  )
}
