// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { FeatureRequestsPanel, type AdminFeatureRequestRow } from './feature-requests-panel'
import {
  FeatureRequestsReports,
  type FeatureRequestQuarterlyReportRow,
} from './feature-requests-reports'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminFeatureRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const query = searchParams.status ? `?status=${searchParams.status}` : ''
  const [rowsRes, reportsRes] = await Promise.all([
    boardFetch(`/api/admin/feature-requests${query}`),
    boardFetch('/api/admin/feature-requests/reports'),
  ])
  const rows: AdminFeatureRequestRow[] = rowsRes.ok ? await rowsRes.json() : []
  const reports: FeatureRequestQuarterlyReportRow[] = reportsRes.ok ? await reportsRes.json() : []

  const activeStatus = searchParams.status ?? ''
  const filterClass = (status: string) => (activeStatus === status ? 'active' : undefined)

  return (
    <>
      <h1 className="admin-section-title">Feature requests</h1>
      <p className="admin-stat-sub">
        Member-suggested features, ranked by votes. Review quarterly — mark planned, in progress,
        done, declined, or close as a duplicate of another request.
      </p>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Quarterly review report</h2>
        <FeatureRequestsReports reports={reports} />
      </section>

      <div className="admin-filter-pills">
        <a href="/admin/feature-requests" className={filterClass('')}>
          All
        </a>
        <a href="/admin/feature-requests?status=OPEN" className={filterClass('OPEN')}>
          Open
        </a>
        <a href="/admin/feature-requests?status=PLANNED" className={filterClass('PLANNED')}>
          Planned
        </a>
        <a href="/admin/feature-requests?status=IN_PROGRESS" className={filterClass('IN_PROGRESS')}>
          In progress
        </a>
        <a href="/admin/feature-requests?status=DONE" className={filterClass('DONE')}>
          Done
        </a>
        <a href="/admin/feature-requests?status=DECLINED" className={filterClass('DECLINED')}>
          Declined
        </a>
        <a href="/admin/feature-requests?status=DUPLICATE" className={filterClass('DUPLICATE')}>
          Duplicate
        </a>
      </div>

      <FeatureRequestsPanel rows={rows} />
    </>
  )
}
