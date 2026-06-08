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

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const query = new URLSearchParams({ limit: '50' })
  if (searchParams.status) query.set('status', searchParams.status)

  const res = await boardFetch(`/api/admin/support/tickets?${query.toString()}`)
  const data = res.ok
    ? ((await res.json()) as {
        tickets: Array<{
          id: string
          subject: string
          category: string
          status: string
          artistUsername: string | null
          contactEmail: string | null
          createdAt: string
        }>
      })
    : { tickets: [] }

  const activeStatus = searchParams.status ?? ''
  const filterClass = (status: string) => (activeStatus === status ? 'active' : undefined)

  return (
    <>
      <h1 className="admin-section-title">Support queue</h1>

      <div className="admin-filter-pills">
        <Link href="/admin/support" className={filterClass('')}>
          All
        </Link>
        <Link href="/admin/support?status=OPEN" className={filterClass('OPEN')}>
          Open
        </Link>
        <Link href="/admin/support?status=IN_PROGRESS" className={filterClass('IN_PROGRESS')}>
          In progress
        </Link>
        <Link href="/admin/support?status=RESOLVED" className={filterClass('RESOLVED')}>
          Resolved
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Subject</th>
              <th>Artist</th>
              <th>Category</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.tickets.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/admin/support/${t.id}`}>{t.id}</Link>
                </td>
                <td>{t.subject}</td>
                <td>{t.artistUsername ?? t.contactEmail ?? '—'}</td>
                <td>{t.category}</td>
                <td className={t.status === 'OPEN' ? 'admin-warn' : ''}>{t.status}</td>
                <td>{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.tickets.length === 0 ? <p className="admin-stat-sub">No tickets.</p> : null}
    </>
  )
}
