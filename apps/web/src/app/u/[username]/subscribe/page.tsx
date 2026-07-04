// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfilePageLayout, SafePlainText } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
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

  const user = await getSessionUser()

  return (
    <ProfilePageLayout
      narrow
      user={user}
      contextLink={{
        href: `/u/${data.artist.username}`,
        label: `← ${data.artist.displayName}`,
      }}
      hero={
        <>
          <h1 className="prof-page-title">Support {data.artist.displayName}</h1>
          {data.artist.bio && (
            <SafePlainText text={data.artist.bio} className="prof-list-meta prof-list-meta--bio" />
          )}
        </>
      }
    >
      {data.tiers.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">Fan subscriptions aren&apos;t available yet.</p>
          <p className="public-empty-card__hint">
            <Link href={`/u/${data.artist.username}`}>Back to profile</Link>
          </p>
        </div>
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
