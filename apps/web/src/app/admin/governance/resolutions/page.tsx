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
  const [res, meetingsRes] = await Promise.all([
    boardFetch('/api/admin/resolutions'),
    boardFetch('/api/admin/governance/meetings'),
  ])
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
        meetingId: string | null
        binding: boolean
      }>)
    : []
  const meetings = meetingsRes.ok
    ? ((await meetingsRes.json()) as Array<{ id: string; title: string }>)
    : []
  const meetingTitleById = new Map(meetings.map((m) => [m.id, m.title]))

  return (
    <>
      <h1 className="admin-section-title">Board resolutions</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/governance">← Governance</Link>
      </p>

      <ResolutionCreateForm meetings={meetings} />

      <section className="admin-card">
        <h2>Recorded resolutions</h2>
        {rows.length === 0 ? (
          <p className="admin-stat-sub">No resolutions yet.</p>
        ) : (
          <div className="admin-table-wrap admin-table-wrap--tabular">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Voted</th>
                  <th>Outcome</th>
                  <th>Vote</th>
                  <th>Meeting</th>
                  <th>Binding</th>
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
                    <td>
                      {r.meetingId ? (meetingTitleById.get(r.meetingId) ?? r.meetingId) : '—'}
                    </td>
                    <td>{r.binding ? 'Binding' : 'Non-binding'}</td>
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
