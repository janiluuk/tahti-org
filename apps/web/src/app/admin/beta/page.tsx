// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { BetaApplicationsPanel, type BetaApplicationRow } from './beta-applications-panel'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminBetaPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const query = new URLSearchParams({ limit: '100' })
  if (searchParams.status) query.set('status', searchParams.status)

  const res = await boardFetch(`/api/admin/beta/applications?${query.toString()}`)
  const applications: BetaApplicationRow[] = res.ok
    ? ((await res.json()) as { applications: BetaApplicationRow[] }).applications
    : []

  return (
    <>
      <h1 className="admin-section-title">Beta applications</h1>
      <p className="admin-help">
        Review private beta applications. Approving creates an artist account and emails a password
        setup link. Artists can sign in after they set a password.
      </p>

      <div className="admin-beta-filters">
        <Link href="/admin/beta">All</Link>
        <Link href="/admin/beta?status=PENDING">Pending</Link>
        <Link href="/admin/beta?status=APPROVED">Approved</Link>
        <Link href="/admin/beta?status=REJECTED">Rejected</Link>
      </div>

      <BetaApplicationsPanel applications={applications} />
    </>
  )
}
