// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminGrantPreviewPanel } from './grant-preview-panel'
import { GrantRunPanel } from './grant-run-panel'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function formatEur(centsStr: string): string {
  return `€${(parseInt(centsStr, 10) / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

export default async function AdminGrantYearPage({ params }: { params: { year: string } }) {
  const year = parseInt(params.year, 10)
  if (isNaN(year) || year < 2020 || year > 2100) redirect('/admin/grants')

  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const meRes = await boardFetch('/api/auth/me')
  if (!meRes.ok) redirect('/login')
  const me = (await meRes.json()) as { isBoard: boolean }
  if (!me.isBoard) {
    return (
      <>
        <h1 className="admin-section-title">{year} Grants</h1>
        <p className="admin-stat-sub">Board access required.</p>
      </>
    )
  }

  const histRes = await boardFetch(`/api/v1/transparency/grants/${year}`)
  const history = histRes.ok
    ? ((await histRes.json()) as {
        year: number
        grantCount: number
        totalCents: string
        grants: Array<{
          publishedAs: string | null
          units: number
          amountCents: string
          state: string
        }>
      })
    : null

  const alreadyRun = (history?.grantCount ?? 0) > 0

  return (
    <>
      <h1 className="admin-section-title">{year} Grant cycle</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/grants">← Grant cycles</Link>
      </p>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Preview (dry run)</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
          Calculates per-artist allocation from engagement units without writing any ledger entries.
          Anomaly flags indicate artists whose unit counts may need manual review before
          disbursement.
        </p>
        <AdminGrantPreviewPanel year={year} />
      </section>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Run disbursement</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
          Writes <code>GRANT_DISBURSEMENT</code> and <code>RESERVE_TRANSFER</code> ledger entries.
          This action is irreversible — run the preview first.
        </p>
        <GrantRunPanel year={year} alreadyRun={alreadyRun} />
      </section>

      {alreadyRun && history && history.grants.length > 0 && (
        <section className="admin-card">
          <h2>
            Disbursed — {history.grantCount} recipients · {formatEur(history.totalCents)}
          </h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Published as</th>
                  <th className="num">Units</th>
                  <th className="num">Amount</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {history.grants.map((g, i) => (
                  <tr key={i}>
                    <td>
                      {g.publishedAs ?? <span style={{ color: 'var(--muted)' }}>anonymous</span>}
                    </td>
                    <td className="num">{g.units.toLocaleString()}</td>
                    <td className="num">{formatEur(g.amountCents)}</td>
                    <td style={{ color: g.state === 'PAID' ? 'var(--green)' : 'var(--muted)' }}>
                      {g.state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
