// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'

interface UserRow {
  id: string
  memberNumber: number | null
  displayName: string
  email: string
  username: string
  tier: string
  isMember: boolean
  isBoard: boolean
  suspendedAt: string | null
  channelState: string | null
  memberSince: string | null
  engagementUnitsYtd: number
}

async function fetchUsers(searchParams: Record<string, string | undefined>) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const params = new URLSearchParams()
  if (searchParams.q) params.set('search', searchParams.q)
  if (searchParams.tier) params.set('tier', searchParams.tier)
  if (searchParams.isMember) params.set('isMember', searchParams.isMember)
  if (searchParams.page) params.set('page', searchParams.page)
  const qs = params.toString()

  const res = await fetch(`${apiUrl}/api/admin/users${qs ? `?${qs}` : ''}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as { page: number; total: number; users: UserRow[] }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; tier?: string; isMember?: string; page?: string }
}) {
  const data = await fetchUsers(searchParams)

  return (
    <>
      <h1 className="admin-section-title">Users</h1>

      <form method="get" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          name="q"
          type="search"
          placeholder="Search name, email, username"
          defaultValue={searchParams.q ?? ''}
          className="admin-search-input"
        />
        <select name="tier" defaultValue={searchParams.tier ?? ''}>
          <option value="">All tiers</option>
          <option value="FREE">FREE</option>
          <option value="ARTIST">ARTIST</option>
          <option value="STUDIO">STUDIO</option>
        </select>
        <select name="isMember" defaultValue={searchParams.isMember ?? ''}>
          <option value="">All members</option>
          <option value="true">Members</option>
          <option value="false">Non-members</option>
        </select>
        <button type="submit">Filter</button>
      </form>

      <p className="admin-stat-sub">
        {data ? `${data.total} users` : 'Could not load users'} ·{' '}
        <a href="/api/admin/users/export.csv">Export CSV</a>
      </p>

      {data && data.users.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Live</th>
                <th>Units YTD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.memberNumber ?? '—'}</td>
                  <td>
                    {u.displayName}
                    {u.isBoard ? ' · board' : ''}
                    {u.suspendedAt ? ' · suspended' : ''}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.tier}</td>
                  <td className={u.channelState === 'LIVE' ? 'admin-ok' : ''}>
                    {u.channelState ?? '—'}
                  </td>
                  <td>{u.engagementUnitsYtd}</td>
                  <td>
                    <Link href={`/admin/users/${u.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-stat-sub">No users match.</p>
      )}

      {data && data.total > 50 ? (
        <p className="admin-stat-sub">Page {data.page}. Use search to narrow results.</p>
      ) : null}
    </>
  )
}
