// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { ResolutionCreateForm } from './resolution-create-form'
import { PublishResolutionButton } from './publish-button'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminResolutionsPage() {
  const res = await boardFetch('/api/admin/resolutions')
  const rows = res.ok
    ? ((await res.json()) as Array<{
        id: string
        title: string
        outcome: string
        voteFor: number
        voteAgainst: number
        voteAbstain: number
        votedAt: string
        publishedAt: string | null
      }>)
    : []

  return (
    <>
      <h1 className="admin-section-title">Board resolutions</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/governance">← Governance</Link>
      </p>

      <ResolutionCreateForm />

      <section className="admin-card">
        <h2>Recorded resolutions</h2>
        {rows.length === 0 ? (
          <p className="admin-stat-sub">No resolutions yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Voted</th>
                  <th>Outcome</th>
                  <th>Vote</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{new Date(r.votedAt).toLocaleDateString()}</td>
                    <td>{r.outcome}</td>
                    <td>
                      {r.voteFor}/{r.voteAgainst}/{r.voteAbstain}
                    </td>
                    <td>{r.publishedAt ? 'Published' : 'Draft'}</td>
                    <td>
                      <PublishResolutionButton id={r.id} published={!!r.publishedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
