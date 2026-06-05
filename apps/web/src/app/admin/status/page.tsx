// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'

export default async function AdminStatusPage() {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/status`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })

  const data = res.ok
    ? ((await res.json()) as {
        status: string
        uptimeSec: number
        checks: Record<
          string,
          { state: string; critical: boolean; latencyMs?: number; detail?: string }
        >
        ts: string
      })
    : null

  return (
    <>
      <h1 className="admin-section-title">Service status</h1>
      {data ? (
        <>
          <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
            Overall: <strong>{data.status}</strong> · uptime {Math.floor(data.uptimeSec / 3600)}h ·
            checked {new Date(data.ts).toLocaleString()}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>State</th>
                  <th>Critical</th>
                  <th>Latency</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.checks).map(([id, check]) => (
                  <tr key={id}>
                    <td>{id}</td>
                    <td className={check.state === 'up' ? 'admin-ok' : 'admin-err'}>
                      {check.state}
                    </td>
                    <td>{check.critical ? 'yes' : 'no'}</td>
                    <td>{check.latencyMs != null ? `${check.latencyMs} ms` : '—'}</td>
                    <td>{check.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="admin-err">Could not load status.</p>
      )}
      <p className="admin-stat-sub" style={{ marginTop: '1rem' }}>
        <Link href="/admin/dashboard">← Dashboard</Link>
      </p>
    </>
  )
}
