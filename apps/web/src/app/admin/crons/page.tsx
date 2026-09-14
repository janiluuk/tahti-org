// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { LogViewer, type LogViewerEntry } from '@tahti/ui'

type CronRun = {
  id: string
  jobName: string
  startedAt: string
  finishedAt: string | null
  outcome: string | null
  errorMessage: string | null
  resultJson: string | null
  durationMs: number | null
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return 'still running'
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 2 : 1)} s`
}

function prettyResult(resultJson: string | null): string {
  if (!resultJson) return 'No result was returned.'
  try {
    return JSON.stringify(JSON.parse(resultJson), null, 2)
  } catch {
    return resultJson
  }
}

function toLogEntry(run: CronRun): LogViewerEntry {
  const state = run.outcome ?? 'RUNNING'
  const result = run.errorMessage ? `Error: ${run.errorMessage}` : prettyResult(run.resultJson)
  return {
    id: run.id,
    timestamp: run.startedAt,
    source: `${state} · ${run.jobName}`,
    title: `${formatDuration(run.durationMs)} · ${run.errorMessage ?? run.resultJson ?? 'no result'}`,
    detail: [
      `Started: ${new Date(run.startedAt).toISOString()}`,
      `Finished: ${run.finishedAt ? new Date(run.finishedAt).toISOString() : 'still running'}`,
      `Duration: ${formatDuration(run.durationMs)}`,
      '',
      result,
    ].join('\n'),
  }
}

export default async function AdminCronRunsPage({
  searchParams,
}: {
  searchParams: { page?: string; jobName?: string }
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const jobName = searchParams.jobName?.trim()
  const query = new URLSearchParams({ page: String(page), limit: '50' })
  if (jobName) query.set('jobName', jobName)

  const response = await boardFetch(`/api/admin/stats/cron-runs/history?${query.toString()}`)
  const data = response.ok
    ? ((await response.json()) as { items: CronRun[]; page: number; limit: number; total: number })
    : { items: [], page: 1, limit: 50, total: 0 }
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit))

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) })
    if (jobName) params.set('jobName', jobName)
    return `/admin/crons?${params.toString()}`
  }

  return (
    <>
      <h1 className="admin-section-title">Cron run log</h1>
      <p className="admin-stat-sub">
        <Link href="/admin/dashboard">← Operations dashboard</Link>
        {' · '}Every scheduled worker run, including its outcome, returned summary, and wall-clock
        duration.
      </p>

      <form method="get" className="admin-log-controls">
        <label>
          Job name
          <input
            type="search"
            name="jobName"
            defaultValue={jobName ?? ''}
            placeholder="e.g. channel-watchdog"
            className="admin-search-input"
          />
        </label>
        <button type="submit" className="admin-btn admin-btn--sm">
          Filter
        </button>
      </form>

      <div className="admin-log-meta">
        {data.total} runs · page {data.page} of {totalPages}
        {jobName ? ` · ${jobName}` : ' · all jobs'}
      </div>

      <LogViewer
        entries={data.items.map(toLogEntry)}
        emptyMessage="No cron runs match this filter."
      />

      <nav className="admin-audit-pager" aria-label="Cron run pages">
        {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : null}
        <span className="admin-stat-sub">
          Page {data.page} of {totalPages}
        </span>
        {page < totalPages ? <Link href={pageHref(page + 1)}>Next →</Link> : null}
      </nav>
    </>
  )
}
