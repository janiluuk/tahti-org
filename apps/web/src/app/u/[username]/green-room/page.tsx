// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { ProfilePageLayout } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
import { GreenRoomGuestView } from './_green-room-guest-view'

export const revalidate = 0

async function fetchProfile(username: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/profile/${encodeURIComponent(username)}`, {
    next: { revalidate: 0 },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('profile fetch failed')
  return (await res.json()) as {
    username: string
    displayName: string
    channel?: { slug: string } | null
  }
}

export default async function GreenRoomPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const [profile, user] = await Promise.all([fetchProfile(username), getSessionUser()])
  if (!profile?.channel?.slug) notFound()

  return (
    <ProfilePageLayout
      narrow
      activeNav="discover"
      user={user}
      contextLink={{
        href: `/u/${profile.username}`,
        label: `← ${profile.displayName}`,
      }}
      hero={<h1 className="prof-page-title">{profile.displayName}&apos;s green room</h1>}
    >
      <GreenRoomGuestView channelSlug={profile.channel.slug} artistUsername={profile.username} />
    </ProfilePageLayout>
  )
}
