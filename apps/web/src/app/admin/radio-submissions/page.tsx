// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { RadioSubmissionsPanel, type RadioSubmissionRow } from './_radio-submissions-panel'

async function adminGet<T>(path: string): Promise<T | null> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

export default async function AdminRadioSubmissionsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const status =
    searchParams.status === 'APPROVED' || searchParams.status === 'REJECTED'
      ? searchParams.status
      : 'PENDING'

  const data = await adminGet<{ items: RadioSubmissionRow[] }>(
    `/api/admin/radio-submissions?status=${status}`,
  )
  const items = data?.items ?? []
  const filterClass = (s: string) => (status === s ? 'active' : undefined)

  return (
    <>
      <h1 className="admin-section-title">Radio submissions</h1>
      <p className="admin-stat-sub">
        Unaudited tracks submitted for Tahti Radio. Play each one in the big player, then approve
        into the public rotation or reject. A rejection note notifies the artist; leave it blank for
        a silent reject.
      </p>

      <div className="admin-filter-pills">
        <a href="/admin/radio-submissions" className={filterClass('PENDING')}>
          Unaudited
        </a>
        <a href="/admin/radio-submissions?status=APPROVED" className={filterClass('APPROVED')}>
          Approved
        </a>
        <a href="/admin/radio-submissions?status=REJECTED" className={filterClass('REJECTED')}>
          Rejected
        </a>
      </div>

      <RadioSubmissionsPanel items={items} />
    </>
  )
}
