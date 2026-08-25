// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import type { MissedLiveShowFlagView } from '@tahti/shared'
import { MissedShowRowActions } from './_missed-show-row-actions'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminMissedShowsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const query = new URLSearchParams({ limit: '100' })
  if (searchParams.status) query.set('status', searchParams.status)

  const res = await boardFetch(`/api/admin/missed-live-shows?${query.toString()}`)
  const data = res.ok ? ((await res.json()) as { flags: MissedLiveShowFlagView[] }) : { flags: [] }

  const activeStatus = searchParams.status ?? ''
  const filterClass = (status: string) => (activeStatus === status ? 'active' : undefined)

  return (
    <>
      <h1 className="admin-section-title">Missed shows</h1>
      <p className="admin-stat-sub">
        Flagged automatically when a scheduled show&apos;s start time passes with no broadcast
        against it.
      </p>

      <div className="admin-filter-pills">
        <Link href="/admin/missed-shows" className={filterClass('')}>
          All
        </Link>
        <Link href="/admin/missed-shows?status=OPEN" className={filterClass('OPEN')}>
          Open
        </Link>
        <Link href="/admin/missed-shows?status=REVIEWING" className={filterClass('REVIEWING')}>
          Reviewing
        </Link>
        <Link href="/admin/missed-shows?status=ACTIONED" className={filterClass('ACTIONED')}>
          Actioned
        </Link>
        <Link href="/admin/missed-shows?status=DISMISSED" className={filterClass('DISMISSED')}>
          Dismissed
        </Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Artist</th>
              <th>Show</th>
              <th>Was scheduled</th>
              <th>Detected</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.flags.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/admin/users/${f.channel.userId}`}>{f.channel.displayName}</Link>
                  <div className="admin-stat-sub">@{f.channel.username}</div>
                </td>
                <td>{f.scheduledLiveShow.title}</td>
                <td>{new Date(f.scheduledLiveShow.startAt).toLocaleString()}</td>
                <td>{new Date(f.detectedAt).toLocaleString()}</td>
                <td className={f.status === 'OPEN' ? 'admin-warn' : ''}>{f.status}</td>
                <td>
                  <MissedShowRowActions flag={f} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.flags.length === 0 ? <p className="admin-stat-sub">No missed shows.</p> : null}
    </>
  )
}
