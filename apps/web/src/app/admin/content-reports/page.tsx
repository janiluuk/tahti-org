// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { ContentReportsPanel, type ContentReportRow } from './content-reports-panel'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminContentReportsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const query = new URLSearchParams({ limit: '50' })
  if (searchParams.status) query.set('status', searchParams.status)

  const res = await boardFetch(`/api/admin/content-reports?${query.toString()}`)
  const data = res.ok ? ((await res.json()) as { reports: ContentReportRow[] }) : { reports: [] }

  const activeStatus = searchParams.status ?? ''
  const filterClass = (status: string) => (activeStatus === status ? 'active' : undefined)

  return (
    <>
      <h1 className="admin-section-title">Content reports</h1>
      <p className="admin-stat-sub">
        Anonymous reports of channels, releases, archive items, and collections — reporting needs no
        account, matching the platform&apos;s anonymous-by-default listener model.
      </p>

      <div className="admin-filter-pills">
        <a href="/admin/content-reports" className={filterClass('')}>
          All
        </a>
        <a href="/admin/content-reports?status=OPEN" className={filterClass('OPEN')}>
          Open
        </a>
        <a href="/admin/content-reports?status=REVIEWING" className={filterClass('REVIEWING')}>
          Reviewing
        </a>
        <a href="/admin/content-reports?status=ACTIONED" className={filterClass('ACTIONED')}>
          Actioned
        </a>
        <a href="/admin/content-reports?status=DISMISSED" className={filterClass('DISMISSED')}>
          Dismissed
        </a>
      </div>

      <ContentReportsPanel reports={data.reports} />
    </>
  )
}
