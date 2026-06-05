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

function formatEur(cents: string | number): string {
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents
  return `€${(n / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface StatusCheck {
  state: string
  critical: boolean
}

export default async function AdminDashboardPage() {
  const [
    statusRes,
    ytdRes,
    membersRes,
    streamsRes,
    queuesRes,
    cronRes,
    auditRes,
    fansubsRes,
    supportRes,
  ] = await Promise.all([
    boardFetch('/api/v1/status'),
    boardFetch('/api/v1/transparency/ytd'),
    boardFetch('/api/admin/stats/members'),
    boardFetch('/api/admin/streams'),
    boardFetch('/api/admin/stats/queues'),
    boardFetch('/api/admin/stats/cron-runs'),
    boardFetch('/api/admin/audit/recent'),
    boardFetch('/api/admin/fansubs/overview'),
    boardFetch('/api/admin/support/tickets?status=OPEN&limit=1'),
  ])

  const failedPayoutCount = fansubsRes.ok
    ? ((await fansubsRes.json()) as { failedPayouts: { count: number } }).failedPayouts.count
    : 0

  const openSupportCount = supportRes.ok
    ? ((await supportRes.json()) as { total: number }).total
    : 0

  const status = statusRes.ok
    ? ((await statusRes.json()) as { checks: Record<string, StatusCheck> })
    : { checks: {} }
  const ytd = ytdRes.ok
    ? ((await ytdRes.json()) as { runningSurplus: string; byCategory: Record<string, string> })
    : { runningSurplus: '0', byCategory: {} }
  const members = membersRes.ok
    ? ((await membersRes.json()) as {
        total: number
        newThisMonth: number
        lapsedThisMonth: number
      })
    : { total: 0, newThisMonth: 0, lapsedThisMonth: 0 }
  const streams = streamsRes.ok
    ? ((await streamsRes.json()) as {
        count: number
        streams: Array<{ slug: string; artistName: string; elapsedSec: number }>
      })
    : { count: 0, streams: [] }
  const queues = queuesRes.ok
    ? ((await queuesRes.json()) as Array<{ name: string; waiting: number; failed: number }>)
    : []
  const cronJobs = cronRes.ok
    ? ((await cronRes.json()) as Array<{
        jobName: string
        description: string
        lastRun: { outcome: string | null; startedAt: string } | null
      }>)
    : []
  const audit = auditRes.ok
    ? ((await auditRes.json()) as Array<{
        id: string
        action: string
        actorId: string
        targetId: string | null
        createdAt: string
      }>)
    : []

  const revenue = Object.entries(ytd.byCategory)
    .filter(([k]) => k.startsWith('REVENUE_'))
    .reduce((s, [, v]) => s + parseInt(v, 10), 0)
  const costs = Object.entries(ytd.byCategory)
    .filter(([k]) => k.startsWith('COST_'))
    .reduce((s, [, v]) => s + parseInt(v, 10), 0)

  return (
    <>
      <h1 className="admin-section-title">Operations dashboard</h1>

      <div className="admin-health-strip">
        {Object.entries(status.checks).map(([id, check]) => (
          <Link key={id} href="/admin/status" className="admin-health-dot">
            <span
              className={`admin-health-dot__indicator admin-health-dot__indicator--${
                check.state === 'up' ? 'ok' : 'down'
              }`}
            />
            {id}
          </Link>
        ))}
      </div>

      <div className="admin-panel-grid">
        <section className="admin-card">
          <h2>Live now</h2>
          <p className="admin-stat">{streams.count}</p>
          <p className="admin-stat-sub">
            <Link href="/admin/streams">View stream manager →</Link>
          </p>
          {streams.streams.slice(0, 3).map((s) => (
            <p key={s.slug} className="admin-stat-sub">
              <Link href={`/c/${s.slug}`}>{s.artistName}</Link> · {formatDuration(s.elapsedSec)}
            </p>
          ))}
        </section>

        <section className="admin-card">
          <h2>Finance YTD</h2>
          <p className="admin-stat">{formatEur(ytd.runningSurplus)}</p>
          <p className="admin-stat-sub">
            Revenue {formatEur(revenue)} · Costs {formatEur(costs)}
          </p>
          {failedPayoutCount > 0 ? (
            <p className="admin-warn">
              {failedPayoutCount} failed fan-sub payout{failedPayoutCount === 1 ? '' : 's'} ·{' '}
              <Link href="/admin/financial/fansubs">View queue →</Link>
            </p>
          ) : null}
        </section>

        <section className="admin-card">
          <h2>Members</h2>
          <p className="admin-stat">{members.total}</p>
          <p className="admin-stat-sub">
            +{members.newThisMonth} this month · {members.lapsedThisMonth} lapsed
          </p>
        </section>

        <section className="admin-card">
          <h2>Support</h2>
          <p className={`admin-stat ${openSupportCount > 0 ? 'admin-warn' : ''}`}>
            {openSupportCount}
          </p>
          <p className="admin-stat-sub">
            open ticket{openSupportCount === 1 ? '' : 's'} ·{' '}
            <Link href="/admin/support">View queue →</Link>
          </p>
        </section>
      </div>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Queue health</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Waiting</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {queues
                .filter((q) => q.name !== '_queue_total')
                .map((q) => (
                  <tr key={q.name}>
                    <td>{q.name}</td>
                    <td className={q.waiting > 50 ? 'admin-warn' : ''}>{q.waiting}</td>
                    <td className={q.failed > 0 ? 'admin-err' : ''}>{q.failed}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Cron jobs</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Last run</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.slice(0, 10).map((job) => (
                <tr key={job.jobName}>
                  <td title={job.description}>{job.jobName}</td>
                  <td>
                    {job.lastRun
                      ? new Date(job.lastRun.startedAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td
                    className={
                      job.lastRun?.outcome === 'ERROR'
                        ? 'admin-err'
                        : job.lastRun?.outcome === 'SUCCESS'
                          ? 'admin-ok'
                          : ''
                    }
                  >
                    {job.lastRun?.outcome ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Recent audit events</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.action}</td>
                  <td>{row.actorId.slice(0, 8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-stat-sub">
          <Link href="/admin/governance/audit">Full audit log →</Link>
          {' · '}
          <a href="/api/admin/audit/export.csv">Export CSV</a>
        </p>
      </section>
    </>
  )
}
