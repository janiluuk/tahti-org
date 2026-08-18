// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { FeedItem } from '@tahti/shared'
import { Heading, Text } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
import { ArtistFeedSection } from '../dashboard/_artist-feed-section'

export const metadata = { title: 'Your feed — Tahti' }

async function fetchFeed(): Promise<{ items: FeedItem[]; followingCount: number }> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const sessionCookie = cookies().get('tahti_session')
  const res = await fetch(`${apiUrl}/api/me/feed`, {
    headers: sessionCookie ? { Cookie: `tahti_session=${sessionCookie.value}` } : undefined,
    cache: 'no-store',
  })
  if (!res.ok) return { items: [], followingCount: 0 }
  return (await res.json()) as { items: FeedItem[]; followingCount: number }
}

export default async function FeedPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?next=/feed')

  // Artists get this same feed embedded on their dashboard main page now —
  // this standalone route stays live for listeners (no dashboard overview
  // of their own) and for anyone with the URL bookmarked.
  const { items, followingCount } = await fetchFeed()

  return (
    <div className="feed-page">
      <Heading level={1}>Your feed</Heading>
      <Text tone="muted">
        New posts, tracks, and releases from the {followingCount} artist
        {followingCount === 1 ? '' : 's'} you follow.
      </Text>
      <ArtistFeedSection items={items} followingCount={followingCount} />
    </div>
  )
}
