// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { LogViewer, type LogViewerEntry } from '@tahti/ui'
import {
  GOVERNANCE_AUDIT_PLANNED_TOPICS,
  GOVERNANCE_AUDIT_TOPICS,
  describeGovernanceAuditItem,
  isGovernanceAuditTopicId,
} from '@tahti/shared'

type AuditItem = {
  id: string
  action: string
  actorId: string
  targetId: string | null
  meta: Record<string, unknown>
  createdAt: string
  actorDisplayName: string | null
  actorUsername: string | null
  topic: string | null
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function toLogEntry(row: AuditItem): LogViewerEntry {
  const line = describeGovernanceAuditItem(row)
  return {
    id: row.id,
    timestamp: row.createdAt,
    source: line.source,
    title: line.title,
    detail: line.detail,
  }
}

export default async function AdminGovernanceAuditPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string; topic?: string }
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const actionFilter = searchParams.action?.trim()
  const topicFilter = searchParams.topic?.trim()
  const topic = topicFilter && isGovernanceAuditTopicId(topicFilter) ? topicFilter : undefined

  const query = new URLSearchParams({ page: String(page), limit: '50', scope: 'governance' })
  if (actionFilter) query.set('action', actionFilter)
  if (topic) query.set('topic', topic)

  const res = await boardFetch(`/api/admin/audit?${query.toString()}`)
  const data = res.ok
    ? ((await res.json()) as {
        page: number
        total: number
        limit: number
        items: AuditItem[]
      })
    : { page: 1, total: 0, limit: 50, items: [] }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))
  const entries = data.items.map(toLogEntry)
  const exportQuery = new URLSearchParams({ scope: 'governance' })
  if (topic) exportQuery.set('topic', topic)

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) })
    if (actionFilter) params.set('action', actionFilter)
    if (topic) params.set('topic', topic)
    return `/admin/governance/audit?${params.toString()}`
  }

  const topicHref = (id?: string) => {
    const params = new URLSearchParams()
    if (id) params.set('topic', id)
    if (actionFilter) params.set('action', actionFilter)
    return `/admin/governance/audit${params.size ? `?${params.toString()}` : ''}`
  }

  return (
    <>
      <h1 className="admin-section-title">Governance audit log</h1>
      <p className="admin-stat-sub">
        <Link href="/admin/governance">← Governance</Link>
        {' · '}
        Association, money, and membership events. Chat, stream keys, and login noise stay on{' '}
        <Link href="/admin/logs">system logs</Link>.{' · '}
        <a href={`/api/admin/audit/export.csv?${exportQuery.toString()}`}>Export CSV</a>
      </p>

      <nav className="admin-filter-pills" aria-label="Audit topics">
        <Link href={topicHref()} className={!topic ? 'active' : undefined}>
          All governance
        </Link>
        {GOVERNANCE_AUDIT_TOPICS.map((item) => (
          <Link
            key={item.id}
            href={topicHref(item.id)}
            className={topic === item.id ? 'active' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {topic ? (
        <p className="admin-help">
          {GOVERNANCE_AUDIT_TOPICS.find((item) => item.id === topic)?.description}
        </p>
      ) : (
        <p className="admin-help">
          Topics: finance and grants, fan subscriptions, membership register, advisory motions,
          board roles, meetings and documents, radio bookings, notices, minutes workflow, and
          official meeting votes.
        </p>
      )}

      <form method="get" className="admin-log-controls">
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <label>
          Action
          <input
            type="search"
            name="action"
            defaultValue={actionFilter ?? ''}
            placeholder="e.g. GRANT_RUN"
            className="admin-search-input"
          />
        </label>
        <button type="submit" className="admin-btn admin-btn--sm">
          Filter
        </button>
      </form>

      <div className="admin-log-meta">
        {data.total} rows · page {data.page} of {totalPages}
        {topic ? ` · ${topic}` : ' · all governance topics'}
      </div>

      <LogViewer
        entries={entries}
        emptyMessage="No governance audit entries match these filters."
      />

      <nav className="admin-audit-pager" aria-label="Audit pages">
        {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : null}
        <span className="admin-stat-sub">
          Page {data.page} of {totalPages}
        </span>
        {page < totalPages ? <Link href={pageHref(page + 1)}>Next →</Link> : null}
      </nav>

      <section className="admin-planned-topics">
        <h2 className="admin-subsection-title">Planned audit topics</h2>
        <ul>
          {GOVERNANCE_AUDIT_PLANNED_TOPICS.map((item) => (
            <li key={item.id}>
              <strong>{item.label}.</strong> {item.description}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
