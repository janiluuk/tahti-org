// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { PublicBrandShell } from '@tahti/ui'
import '@tahti/ui/src/styles/brand-public.css'

interface StatusPayload {
  status: 'operational' | 'degraded' | 'outage'
  version: string
  uptimeSec: number
  checks: Record<string, { state: string; critical: boolean; latencyMs?: number; detail?: string }>
  ts: string
}

const STATUS_LABEL: Record<StatusPayload['status'], string> = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  outage: 'Service disruption',
}

async function fetchStatus(): Promise<StatusPayload | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/status`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as StatusPayload
  } catch {
    return null
  }
}

export default async function StatusPage() {
  const data = await fetchStatus()
  const overall = data?.status ?? 'outage'

  return (
    <PublicBrandShell wide>
      <div className="status-page">
        <h1 className="status-page__title">Tahti platform status</h1>
        <p className={`status-page__banner status-page__banner--${overall}`}>
          {data ? STATUS_LABEL[data.status] : 'Status unavailable'}
        </p>
        {data ? (
          <>
            <p className="status-page__meta">
              API v{data.version} · uptime {Math.floor(data.uptimeSec / 3600)}h · checked{' '}
              {new Date(data.ts).toLocaleString()}
            </p>
            <div className="status-page__table-wrap">
              <table className="status-page__table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>State</th>
                    <th>Latency</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.checks).map(([id, check]) => (
                    <tr key={id}>
                      <td>{id}</td>
                      <td
                        className={check.state === 'up' ? 'status-page__up' : 'status-page__down'}
                      >
                        {check.state}
                        {check.critical ? ' · critical' : ''}
                      </td>
                      <td>{check.latencyMs != null ? `${check.latencyMs} ms` : '—'}</td>
                      <td>{check.detail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="status-page__meta">
            Could not reach the status API. The platform may be undergoing maintenance.
          </p>
        )}
        <p className="status-page__footer">
          <Link href="/">Home</Link>
          {' · '}
          <Link href="/transparency">Transparency</Link>
          {' · '}
          <a href="https://github.com/tahtiapp/tahti">Source (AGPL)</a>
        </p>
      </div>
    </PublicBrandShell>
  )
}
