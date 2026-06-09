// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface MeResponse {
  isBoard: boolean
}

interface GrantYearSummary {
  year: number
  grantCount: number
  totalCents: string
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

async function fetchGrantHistory(): Promise<GrantYearSummary[]> {
  const currentYear = new Date().getUTCFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const results = await Promise.all(
    years.map(async (year) => {
      const res = await boardFetch(`/api/v1/transparency/grants/${year}`)
      if (!res.ok) return null
      const data = (await res.json()) as { year: number; grantCount: number; totalCents: string }
      if (data.grantCount === 0) return null
      return { year: data.year, grantCount: data.grantCount, totalCents: data.totalCents }
    }),
  )

  return results.filter((r): r is GrantYearSummary => r !== null)
}

function formatEur(centsStr: string): string {
  const cents = parseInt(centsStr, 10)
  return `€${(cents / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

export default async function AdminGrantsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const meRes = await boardFetch('/api/auth/me')
  if (!meRes.ok) redirect('/login')
  const me = (await meRes.json()) as MeResponse
  if (!me.isBoard) {
    return (
      <>
        <h1 className="admin-section-title">Grants</h1>
        <p className="admin-stat-sub">Board access required.</p>
      </>
    )
  }

  const history = await fetchGrantHistory()
  const currentYear = new Date().getUTCFullYear()
  const lastYear = currentYear - 1

  return (
    <>
      <h1 className="admin-section-title">Grant cycles</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/financial">← Financial</Link>
        {' · '}
        Annual 90%-surplus disbursement to artists based on engagement units.
      </p>

      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <h2>Run or preview a grant cycle</h2>
        <p style={{ marginBottom: '1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
          Select a year to preview the per-artist allocation and run the disbursement. The preview
          is a dry run — no ledger entries are written until you click Run.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[lastYear, lastYear - 1, lastYear - 2].map((y) => (
            <Link key={y} href={`/admin/grants/${y}`} className="admin-btn">
              {y} grants →
            </Link>
          ))}
        </div>
      </div>

      <section className="admin-card">
        <h2>Disbursement history</h2>
        {history.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            No grant cycles have been run yet. Preview and run the {lastYear} cycle above.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="num">Recipients</th>
                  <th className="num">Total disbursed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td className="num">{row.grantCount}</td>
                    <td className="num">{formatEur(row.totalCents)}</td>
                    <td>
                      <Link href={`/admin/grants/${row.year}`} className="admin-inline-link">
                        View →
                      </Link>
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
