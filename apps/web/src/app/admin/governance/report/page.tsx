// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { AnnualReportGenerator } from './annual-report-generator'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminAnnualReportPage() {
  const res = await boardFetch('/api/admin/reports')
  const reports = res.ok
    ? ((await res.json()) as Array<{
        id: string
        year: number
        generatedAt: string
        generatedByDisplayName: string | null
        downloadUrl: string | null
      }>)
    : []

  return (
    <>
      <h1 className="admin-section-title">Annual report</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/governance">← Governance</Link>
      </p>

      <AnnualReportGenerator />

      <section className="admin-card">
        <h2>Previously generated</h2>
        {reports.length === 0 ? (
          <p className="admin-stat-sub">No reports stored yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Generated</th>
                  <th>By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.year}</td>
                    <td>{new Date(r.generatedAt).toLocaleString()}</td>
                    <td>{r.generatedByDisplayName ?? '—'}</td>
                    <td>
                      {r.downloadUrl ? (
                        <a href={r.downloadUrl} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      ) : (
                        '—'
                      )}
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
