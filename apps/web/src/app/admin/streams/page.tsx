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

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default async function AdminStreamsPage() {
  const res = await boardFetch('/api/admin/streams')
  const data = res.ok
    ? ((await res.json()) as {
        count: number
        streams: Array<{
          slug: string
          artistName: string
          username: string
          elapsedSec: number
          goneLiveAt: string | null
        }>
      })
    : { count: 0, streams: [] }

  return (
    <>
      <h1 className="admin-section-title">Stream manager</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        {data.count} channel{data.count === 1 ? '' : 's'} live · refreshes on load
      </p>

      {data.streams.length === 0 ? (
        <p className="admin-stat-sub">No channels are live right now.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Artist</th>
                <th>Channel</th>
                <th>Live since</th>
                <th>Elapsed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.streams.map((s) => (
                <tr key={s.slug}>
                  <td>
                    <Link href={`/u/${s.username}`}>{s.artistName}</Link>
                  </td>
                  <td>
                    <Link href={`/c/${s.slug}`}>{s.slug}</Link>
                  </td>
                  <td>
                    {s.goneLiveAt
                      ? new Date(s.goneLiveAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td>{formatDuration(s.elapsedSec)}</td>
                  <td>
                    <Link href={`/c/${s.slug}`}>Public page</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
