// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { LedgerEntryForm } from './ledger-entry-form'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function formatEur(cents: string): string {
  return `€${(parseInt(cents, 10) / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  const year = searchParams.year ?? String(new Date().getUTCFullYear())
  const month = searchParams.month
  const query = new URLSearchParams({ year })
  if (month) query.set('month', month)

  const res = await boardFetch(`/api/admin/ledger?${query.toString()}`)
  const entries = res.ok
    ? ((await res.json()) as Array<{
        id: string
        category: string
        amountCents: string
        description: string
        periodStart: string
        periodEnd: string
        createdAt: string
      }>)
    : []

  return (
    <>
      <h1 className="admin-section-title">Ledger</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/financial">← Financial</Link>
        {' · '}
        <a href={`/api/admin/ledger/export.csv?year=${year}`}>Export CSV</a>
      </p>

      <LedgerEntryForm />

      <section className="admin-card">
        <h2>
          Entries ({year}
          {month ? ` / ${month}` : ''})
        </h2>
        {entries.length === 0 ? (
          <p className="admin-stat-sub">No entries for this period.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Period</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td>{e.category}</td>
                    <td>{formatEur(e.amountCents)}</td>
                    <td>{e.description}</td>
                    <td>
                      {new Date(e.periodStart).toLocaleDateString()} –{' '}
                      {new Date(e.periodEnd).toLocaleDateString()}
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
