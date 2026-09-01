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

interface WorkerSummary {
  name: string
  lanes: string[]
  status: 'online' | 'offline'
  jobStatus: string | null
  hostname: string | null
  lastJobName: string | null
  lastJobAt: string | null
}

export default async function AdminWorkersPage() {
  const res = await boardFetch('/api/admin/workers')
  const data: { workers: WorkerSummary[] } = res.ok
    ? ((await res.json()) as { workers: WorkerSummary[] })
    : { workers: [] }

  return (
    <>
      <h1 className="admin-section-title">Worker nodes</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        Self-registered from the BullMQ media queue — a node that stops heartbeating shows as
        offline rather than disappearing.
      </p>
      {data.workers.length === 0 ? (
        <p className="admin-stat-sub">No worker nodes have registered yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Lanes</th>
                <th>Status</th>
                <th>Last job</th>
                <th>Last job at</th>
              </tr>
            </thead>
            <tbody>
              {data.workers.map((w) => (
                <tr key={w.name}>
                  <td>
                    <Link href={`/admin/workers/${encodeURIComponent(w.name)}`}>{w.name}</Link>
                    {w.hostname ? (
                      <span className="admin-stat-sub"> · {w.hostname}</span>
                    ) : null}
                  </td>
                  <td>{w.lanes.length ? w.lanes.join(', ') : '—'}</td>
                  <td className={w.status === 'online' ? 'admin-ok' : 'admin-err'}>
                    {w.status}
                    {w.status === 'online' && w.jobStatus ? ` · ${w.jobStatus}` : ''}
                  </td>
                  <td>{w.lastJobName ?? '—'}</td>
                  <td>{w.lastJobAt ? new Date(w.lastJobAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
