// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

type LegacyMember = {
  id: string
  memberNumber: number | null
  displayName: string
  email: string
  username: string
  memberSince: string | null
}

export default async function AdminLegacyMembersPage() {
  const res = await boardFetch('/api/admin/members/legacy-subscriptions')
  const members: LegacyMember[] = res.ok ? ((await res.json()) as LegacyMember[]) : []

  return (
    <>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        <Link href="/admin/financial">← Financial</Link>
      </p>
      <h1 className="admin-section-title">Legacy membership migration</h1>
      <p className="admin-help">
        Active members without a Stripe subscription id. They should migrate via dashboard checkout
        when Stripe billing is enabled.
      </p>

      {members.length === 0 ? (
        <p className="admin-text-muted">No legacy members in the queue (or Stripe is disabled).</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Username</th>
              <th>Member since</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.memberNumber ?? '—'}</td>
                <td>
                  <Link href={`/admin/users/${m.id}`}>{m.displayName}</Link>
                </td>
                <td>{m.email}</td>
                <td>@{m.username}</td>
                <td>{m.memberSince ? new Date(m.memberSince).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
