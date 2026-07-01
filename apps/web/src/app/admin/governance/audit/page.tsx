// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'

const ACTION_LABELS: Record<string, string> = {
  CHAT_BAN: 'Chat: user banned',
  CHAT_UNBAN: 'Chat: ban lifted',
  CHAT_MESSAGE_DELETE: 'Chat: message deleted',
  STREAM_KEY_ROTATE: 'Stream key rotated',
  STREAM_FORCE_OFFLINE: 'Stream forced offline',
  LEDGER_ENTRY_CREATE: 'Ledger: entry created',
  GRANT_RUN: 'Grant round run',
  USER_SUSPEND: 'Account suspended',
  USER_UNSUSPEND: 'Suspension lifted',
  BOARD_ROLE_CHANGE: 'Board role changed',
  ENGAGEMENT_ADJUSTMENT: 'Engagement units adjusted',
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string }
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const actionFilter = searchParams.action?.trim()
  const query = new URLSearchParams({ page: String(page), limit: '50' })
  if (actionFilter) query.set('action', actionFilter)

  const res = await boardFetch(`/api/admin/audit?${query.toString()}`)
  const data = res.ok
    ? ((await res.json()) as {
        page: number
        total: number
        limit: number
        items: Array<{
          id: string
          action: string
          actorId: string
          targetId: string | null
          meta: Record<string, unknown>
          createdAt: string
          actorDisplayName: string | null
          actorUsername: string | null
        }>
      })
    : { page: 1, total: 0, limit: 50, items: [] }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  return (
    <>
      <h1 className="admin-section-title">Audit log</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/governance">← Governance</Link>
        {' · '}
        <a href="/api/admin/audit/export.csv">Export CSV</a>
      </p>

      <form method="get" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="search"
          name="action"
          defaultValue={actionFilter ?? ''}
          placeholder="Filter by action (e.g. USER_SUSPEND)"
          className="admin-search-input"
        />
        <button type="submit" className="admin-btn admin-btn--sm">
          Filter
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td>
                  {new Date(row.createdAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td>{actionLabel(row.action)}</td>
                <td>
                  {row.actorUsername ? (
                    <Link href={`/admin/users?search=${encodeURIComponent(row.actorUsername)}`}>
                      {row.actorDisplayName ?? row.actorUsername}
                    </Link>
                  ) : (
                    row.actorId.slice(0, 8)
                  )}
                </td>
                <td>{row.targetId ?? '—'}</td>
                <td>
                  <code style={{ fontSize: '0.75rem' }}>
                    {JSON.stringify(row.meta).slice(0, 80)}
                    {JSON.stringify(row.meta).length > 80 ? '…' : ''}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.total === 0 ? <p className="admin-stat-sub">No audit entries match.</p> : null}

      <nav style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        {page > 1 ? (
          <Link
            href={`/admin/governance/audit?page=${page - 1}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`}
          >
            ← Previous
          </Link>
        ) : null}
        <span className="admin-stat-sub">
          Page {data.page} of {totalPages} ({data.total} rows)
        </span>
        {page < totalPages ? (
          <Link
            href={`/admin/governance/audit?page=${page + 1}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`}
          >
            Next →
          </Link>
        ) : null}
      </nav>
    </>
  )
}
