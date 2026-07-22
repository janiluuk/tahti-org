// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { SuspendUserForm, UserAdminActions } from './user-admin-panel'

async function fetchUser(id: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/admin/users/${id}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  return (await res.json()) as UserDetail
}

interface UserDetail {
  id: string
  email: string
  username: string
  displayName: string
  tier: string
  isMember: boolean
  isBoard: boolean
  memberNumber: number | null
  memberSince: string | null
  suspendedAt: string | null
  suspendReason: string | null
  engagementUnitsYtd: number
  fanSubscriptionsAsArtist: number
  stripeConnectChargesEnabled: boolean
  channel: {
    slug: string
    state: string
    goneLiveAt: string | null
    totalLiveHours: number
  } | null
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id)
  if (!user) notFound()

  return (
    <>
      <p className="admin-stat-sub">
        <Link href="/admin/users">← Users</Link>
      </p>
      <h1 className="admin-section-title">{user.displayName}</h1>
      <p className="admin-stat-sub">
        @{user.username} · {user.email} · {user.tier}
        {user.isMember ? ' · member' : ''}
        {user.isBoard ? ' · board' : ''}
      </p>

      {user.suspendedAt ? (
        <p className="admin-err">
          Suspended since {new Date(user.suspendedAt).toLocaleString()}
          {user.suspendReason ? `: ${user.suspendReason}` : ''}
        </p>
      ) : null}

      <div className="admin-panel-grid">
        <section className="admin-card">
          <h2>Engagement</h2>
          <p className="admin-stat">{user.engagementUnitsYtd}</p>
          <p className="admin-stat-sub">units YTD</p>
          <p className="admin-stat-sub">{user.fanSubscriptionsAsArtist} active fan subs</p>
        </section>

        <section className="admin-card">
          <h2>Channel</h2>
          {user.channel ? (
            <>
              <p>
                <Link href={`/c/${user.channel.slug}`}>{user.channel.slug}</Link> ·{' '}
                {user.channel.state}
              </p>
              <p className="admin-stat-sub">{user.channel.totalLiveHours.toFixed(1)} live hours</p>
              <p className="admin-stat-sub">
                <Link href={`/admin/channels/${user.channel.slug}/programme`}>
                  Edit 24/7 playlist →
                </Link>
              </p>
              <p className="admin-stat-sub">
                <Link href={`/admin/channels/${user.channel.slug}/archive`}>Edit music →</Link>
              </p>
            </>
          ) : (
            <p className="admin-stat-sub">No channel</p>
          )}
        </section>

        <section className="admin-card">
          <h2>Stripe Connect</h2>
          <p>{user.stripeConnectChargesEnabled ? 'Charges enabled' : 'Not ready'}</p>
        </section>
      </div>

      <UserAdminActions
        userId={user.id}
        isBoard={user.isBoard}
        suspended={Boolean(user.suspendedAt)}
      />

      {!user.suspendedAt ? <SuspendUserForm userId={user.id} /> : null}
    </>
  )
}
