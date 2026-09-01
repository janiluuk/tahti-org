// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

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
  pid: number | null
  startedAt: string | null
  updatedAt: string | null
  lastJobName: string | null
  lastJobId: string | null
  lastJobStatus: string | null
  lastJobAt: string | null
}

interface JobEvent {
  jobId: string
  jobName: string
  status: 'active' | 'completed' | 'failed'
  at: string
  errorMessage?: string
}

export default async function AdminWorkerDetailPage({ params }: { params: { name: string } }) {
  const res = await boardFetch(`/api/admin/workers/${encodeURIComponent(params.name)}`)
  if (res.status === 404) notFound()
  if (!res.ok) {
    return <p className="admin-err">Could not load worker node.</p>
  }

  const data = (await res.json()) as { worker: WorkerSummary; history: JobEvent[] }
  const { worker, history } = data

  return (
    <>
      <p className="admin-stat-sub">
        <Link href="/admin/workers">← Worker nodes</Link>
      </p>
      <h1 className="admin-section-title">{worker.name}</h1>
      <p className="admin-stat-sub">
        {worker.hostname ? `${worker.hostname} · ` : ''}
        {worker.pid != null ? `pid ${worker.pid} · ` : ''}
        lanes: {worker.lanes.length ? worker.lanes.join(', ') : '—'}
      </p>
      <p className={worker.status === 'online' ? 'admin-ok' : 'admin-err'}>
        {worker.status}
        {worker.status === 'online' && worker.jobStatus ? ` · ${worker.jobStatus}` : ''}
        {worker.updatedAt ? ` · last seen ${new Date(worker.updatedAt).toLocaleString()}` : ''}
      </p>

      <h2 className="admin-section-title" style={{ marginTop: '1.5rem' }}>
        Recent activity
      </h2>
      {history.length === 0 ? (
        <p className="admin-stat-sub">No jobs recorded for this node yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>At</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {history.map((event, i) => (
                <tr key={`${event.jobId}-${event.status}-${i}`}>
                  <td>{event.jobName}</td>
                  <td className={event.status === 'failed' ? 'admin-err' : 'admin-ok'}>
                    {event.status}
                  </td>
                  <td>{new Date(event.at).toLocaleString()}</td>
                  <td>{event.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
