// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ButtonIcon,
  DataRowList,
  DataRowListEmpty,
  DataRowListRow,
  KpiCard,
  KpiCardRow,
  StatusPill,
} from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'

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

const NEEDS_ACTION_COLUMNS = '1fr auto'
const HEALTH_COLUMNS = '1fr auto'

interface ActionRow {
  key: string
  title: string
  meta: string
  actionLabel: string
  actionTone: 'primary' | 'amber'
  href: string
}

export default async function AdminDashboardPage() {
  const [
    ytdRes,
    membersRes,
    streamsRes,
    queuesRes,
    cronRes,
    auditRes,
    fansubsRes,
    failedPayoutsRes,
    supportRes,
    betaRes,
    venuesRes,
    healthRes,
  ] = await Promise.all([
    boardFetch('/api/v1/transparency/ytd'),
    boardFetch('/api/admin/stats/members'),
    boardFetch('/api/admin/streams'),
    boardFetch('/api/admin/stats/queues'),
    boardFetch('/api/admin/stats/cron-runs'),
    boardFetch('/api/admin/audit/recent'),
    boardFetch('/api/admin/fansubs/overview'),
    boardFetch('/api/admin/fansubs/payouts?state=FAILED&limit=10'),
    boardFetch('/api/admin/support/tickets?status=OPEN&limit=1'),
    boardFetch('/api/admin/beta/applications?status=PENDING&limit=100'),
    boardFetch('/api/admin/venues'),
    boardFetch('/api/admin/stats/system-health'),
  ])

  const failedPayoutCount = fansubsRes.ok
    ? ((await fansubsRes.json()) as { failedPayouts: { count: number } }).failedPayouts.count
    : 0

  const failedPayouts = failedPayoutsRes.ok
    ? (
        (await failedPayoutsRes.json()) as {
          payouts: Array<{
            id: string
            artistDisplayName: string
            artistUsername: string
            netToArtistCents: number
          }>
        }
      ).payouts
    : []

  const openSupportCount = supportRes.ok
    ? ((await supportRes.json()) as { total: number }).total
    : 0

  const betaApplications = betaRes.ok
    ? (
        (await betaRes.json()) as {
          applications: Array<{
            id: string
            name: string
            artistType: string
            createdAt: string
          }>
        }
      ).applications
    : []

  const pendingVenues = venuesRes.ok
    ? (
        (await venuesRes.json()) as Array<{
          id: string
          name: string
          city: string
          countryCode: string
          verifiedAt: string | null
          createdAt: string
        }>
      ).filter((v) => v.verifiedAt === null)
    : []

  const health = healthRes.ok
    ? ((await healthRes.json()) as {
        icecast: 'up' | 'down'
        minio: 'up' | 'down'
        postgresBackupAgeHours: number | null
        failedFanSubPayouts: number
      })
    : {
        icecast: 'down' as const,
        minio: 'down' as const,
        postgresBackupAgeHours: null,
        failedFanSubPayouts: 0,
      }

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

  const actionRows: ActionRow[] = [
    ...betaApplications.map(
      (a): ActionRow => ({
        key: `beta-${a.id}`,
        title: `${a.name} · ${a.artistType}`,
        meta: `Beta application · applied ${new Date(a.createdAt).toLocaleDateString('fi-FI')}`,
        actionLabel: 'Approve',
        actionTone: 'primary',
        href: '/admin/beta?status=PENDING',
      }),
    ),
    ...pendingVenues.map(
      (v): ActionRow => ({
        key: `venue-${v.id}`,
        title: `${v.name}, ${v.city}`,
        meta: `Venue verification · submitted ${new Date(v.createdAt).toLocaleDateString('fi-FI')}`,
        actionLabel: 'Verify',
        actionTone: 'primary',
        href: '/governance/venues',
      }),
    ),
    ...failedPayouts.map(
      (p): ActionRow => ({
        key: `payout-${p.id}`,
        title: `@${p.artistUsername} — ${formatEur(p.netToArtistCents)}`,
        meta: 'Fan-sub payout failed',
        actionLabel: 'Retry',
        actionTone: 'amber',
        href: '/admin/financial/fansubs',
      }),
    ),
  ]

  const visibleActionRows = actionRows.slice(0, 6)
  const overflowCount = actionRows.length - visibleActionRows.length

  const backupAge = health.postgresBackupAgeHours
  const backupTone =
    backupAge === null ? 'coral' : backupAge > 48 ? 'coral' : backupAge > 26 ? 'amber' : 'green'

  return (
    <>
      <h1 className="admin-section-title">Operations dashboard</h1>

      <KpiCardRow aria-label="Operations summary">
        <KpiCard color="cyan" value={members.total} label="Active members" />
        <KpiCard color="green" value={streams.count} label="Live now" />
        <KpiCard color="amber" value={betaApplications.length} label="Beta queue" />
        <KpiCard color="coral" value={openSupportCount} label="Open tickets" />
      </KpiCardRow>

      <div className="admin-dashboard-grid">
        <div>
          <p className="transparency-grid__label">Needs action</p>
          {visibleActionRows.length === 0 ? (
            <DataRowList>
              <DataRowListEmpty>Nothing needs action right now.</DataRowListEmpty>
            </DataRowList>
          ) : (
            <DataRowList>
              {visibleActionRows.map((row) => (
                <DataRowListRow key={row.key} columns={NEEDS_ACTION_COLUMNS}>
                  <span>
                    <span style={{ color: 'var(--text)' }}>{row.title}</span>
                    <br />
                    <span style={{ fontSize: '11px', color: 'var(--muted2)' }}>{row.meta}</span>
                  </span>
                  <span className="admin-dashboard-actions">
                    <Link
                      href={row.href}
                      className={`ui-btn ui-btn--sm ${
                        row.actionTone === 'amber'
                          ? 'ui-btn--secondary admin-action--amber'
                          : 'ui-btn--primary'
                      }`}
                    >
                      <ButtonIcon name="arrowRight" />
                      {row.actionLabel}
                    </Link>
                    <Link href={row.href} className="ui-btn ui-btn--secondary ui-btn--sm">
                      View
                    </Link>
                  </span>
                </DataRowListRow>
              ))}
              {overflowCount > 0 && (
                <DataRowListRow columns="1fr">
                  <Link href="/admin/beta?status=PENDING" className="admin-dashboard-more">
                    View all queues →
                  </Link>
                </DataRowListRow>
              )}
            </DataRowList>
          )}
        </div>

        <div>
          <p className="transparency-grid__label">System health</p>
          <DataRowList>
            <DataRowListRow columns={HEALTH_COLUMNS}>
              <span>Icecast / Liquidsoap</span>
              <StatusPill tone={health.icecast === 'up' ? 'green' : 'coral'}>
                {health.icecast === 'up' ? 'OK' : 'DOWN'}
              </StatusPill>
            </DataRowListRow>
            <DataRowListRow columns={HEALTH_COLUMNS}>
              <span>Postgres backup age</span>
              <StatusPill tone={backupTone}>
                {backupAge === null ? 'UNKNOWN' : `${Math.round(backupAge)} H`}
              </StatusPill>
            </DataRowListRow>
            <DataRowListRow columns={HEALTH_COLUMNS}>
              <span>MinIO storage</span>
              <StatusPill tone={health.minio === 'up' ? 'green' : 'coral'}>
                {health.minio === 'up' ? 'OK' : 'DOWN'}
              </StatusPill>
            </DataRowListRow>
            <DataRowListRow columns={HEALTH_COLUMNS}>
              <span>Fan-sub payouts</span>
              <StatusPill tone={health.failedFanSubPayouts > 0 ? 'amber' : 'green'}>
                {health.failedFanSubPayouts > 0 ? `${health.failedFanSubPayouts} RETRY` : 'OK'}
              </StatusPill>
            </DataRowListRow>
          </DataRowList>
          <p className="admin-dashboard-health-footer">
            Cron runs logged · audit trail at{' '}
            <Link href="/admin/governance/audit">/admin/governance/audit</Link> · force-offline in{' '}
            <Link href="/admin/streams">Streams</Link>
          </p>
        </div>
      </div>

      {failedPayoutCount > 0 && (
        <p className="admin-warn" style={{ marginBottom: '1rem' }}>
          {failedPayoutCount} failed fan-sub payout{failedPayoutCount === 1 ? '' : 's'} ·{' '}
          <Link href="/admin/financial/fansubs">View queue →</Link>
        </p>
      )}

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Finance YTD</h2>
        <p className="admin-stat">{formatEur(ytd.runningSurplus)}</p>
        <p className="admin-stat-sub">
          Revenue {formatEur(revenue)} · Costs {formatEur(costs)}
        </p>
      </section>

      {streams.streams.length > 0 && (
        <details className="admin-card studio-details-block" style={{ marginBottom: '1.5rem' }}>
          <summary>Live now ({streams.streams.length})</summary>
          <div style={{ marginTop: '0.75rem' }}>
            {streams.streams.slice(0, 3).map((s) => (
              <p key={s.slug} className="admin-stat-sub">
                <Link href={resolveChannelUrl(s.slug)}>{s.artistName}</Link> ·{' '}
                {formatDuration(s.elapsedSec)}
              </p>
            ))}
            <p className="admin-stat-sub">
              <Link href="/admin/streams">View stream manager →</Link>
            </p>
          </div>
        </details>
      )}

      <details className="admin-card studio-details-block" style={{ marginBottom: '1.5rem' }}>
        <summary>Queue health</summary>
        <div className="admin-table-wrap" style={{ marginTop: '0.75rem' }}>
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
      </details>

      <details className="admin-card studio-details-block" style={{ marginBottom: '1.5rem' }}>
        <summary>Cron jobs</summary>
        <div className="admin-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Last run</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.slice(0, 5).map((job) => (
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
      </details>

      <details className="admin-card studio-details-block">
        <summary>Recent audit events</summary>
        <div style={{ marginTop: '0.75rem' }}>
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
                {audit.slice(0, 5).map((row) => (
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
        </div>
      </details>
    </>
  )
}
