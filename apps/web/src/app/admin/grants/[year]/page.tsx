// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  KpiCard,
  KpiCardRow,
  StatusPill,
} from '@tahti/ui'
import { GrantRunPanel } from './grant-run-panel'

const ALLOCATION_COLUMNS = '1fr 90px 90px 90px 80px'
const PAGE_SIZE = 50

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

function formatEur(cents: number): string {
  return `€${(cents / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })}`
}

function formatEurFromString(centsStr: string): string {
  return formatEur(parseInt(centsStr, 10))
}

interface GrantPreviewArtist {
  userId: string
  username: string
  displayName: string
  units: number
  amountCents: number
  freeDownloads: number
  paidDownloads: number
  fanSubEuros: number
  anomalies: Array<{ code: string; message: string }>
}

interface GrantPreview {
  forYear: number
  alreadyRun: boolean
  poolCents: number
  totalUnits: number
  unallocatedCents: number
  artists: GrantPreviewArtist[]
}

interface GrantHistory {
  year: number
  grantCount: number
  totalCents: string
  disbursedAt: string | null
  grants: Array<{
    publishedAs: string | null
    units: number
    amountCents: string
    state: string
  }>
}

const MIN_UNITS = 5

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

  const [previewRes, histRes] = await Promise.all([
    boardFetch(`/api/admin/grants/preview/${year}`),
    boardFetch(`/api/v1/transparency/grants/${year}`),
  ])

  const preview = previewRes.ok ? ((await previewRes.json()) as GrantPreview) : null
  const history = histRes.ok ? ((await histRes.json()) as GrantHistory) : null

  if (!preview) {
    return (
      <>
        <h1 className="admin-section-title">{year} Grant cycle</h1>
        <p className="admin-stat-sub" style={{ color: 'var(--coral)' }}>
          Failed to load the grant preview for {year}.
        </p>
      </>
    )
  }

  const alreadyRun = preview.alreadyRun || (history?.grantCount ?? 0) > 0
  const eligible = preview.artists.filter((a) => a.units >= MIN_UNITS)
  const belowThreshold = preview.artists.filter((a) => a.units < MIN_UNITS)

  const allocatedCents = preview.artists.reduce((s, a) => s + a.amountCents, 0)
  const sumCheckOk = allocatedCents + preview.unallocatedCents === preview.poolCents

  const sorted = [...preview.artists].sort((a, b) => b.units - a.units)
  const visible = sorted.slice(0, PAGE_SIZE)
  const overflow = sorted.slice(PAGE_SIZE)
  const overflowAvgCents = overflow.length
    ? overflow.reduce((s, a) => s + a.amountCents, 0) / overflow.length
    : 0

  const disbursedDate = history?.disbursedAt
    ? new Date(history.disbursedAt).toLocaleDateString('fi-FI')
    : null

  return (
    <>
      <div className="admin-header-row">
        <div>
          <div className="admin-header-row__title-line">
            <h3 className="admin-header-row__title">Grant cycle {year}</h3>
            {alreadyRun ? (
              <StatusPill tone="green">
                DISTRIBUTED{disbursedDate ? ` ${disbursedDate}` : ''}
              </StatusPill>
            ) : (
              <StatusPill tone="amber">DRY RUN</StatusPill>
            )}
          </div>
          <p className="admin-header-row__subline">
            Largest-remainder allocation · engagement units from downloads + fan-sub euros · March 1
            cron
          </p>
        </div>
        <div className="admin-header-row__actions">
          <a
            className="ui-btn ui-btn--sm ui-btn--secondary"
            href={`/api/admin/grants/export.csv?year=${year}`}
          >
            ⬇ Board CSV
          </a>
          {!alreadyRun && (
            <GrantRunPanel
              year={year}
              poolCents={preview.poolCents}
              artistCount={eligible.length}
              sumCheckOk={sumCheckOk}
            />
          )}
        </div>
      </div>

      <KpiCardRow aria-label="Grant cycle summary">
        <KpiCard color="green" value={formatEur(preview.poolCents)} label="Pool (90% of surplus)" />
        <KpiCard
          color="cyan"
          value={preview.totalUnits.toLocaleString()}
          label="Total engagement units"
        />
        <KpiCard
          color="purple"
          value={eligible.length}
          label={`Eligible artists ≥${MIN_UNITS} units`}
        />
        <KpiCard color="amber" value={belowThreshold.length} label="Below threshold" />
      </KpiCardRow>

      <h4 className="admin-section-label">Per-artist allocation (preview)</h4>
      <DataRowList>
        <DataRowListHeader columns={ALLOCATION_COLUMNS}>
          <span>Artist</span>
          <span className="num">Downloads</span>
          <span className="num">Fan-sub €</span>
          <span className="num">Units</span>
          <span className="num">Grant</span>
        </DataRowListHeader>
        {visible.length === 0 && (
          <DataRowListEmpty>No qualifying artists for {year}.</DataRowListEmpty>
        )}
        {visible.map((a) => (
          <DataRowListRow key={a.userId} columns={ALLOCATION_COLUMNS}>
            <span>
              <Link href={`/u/${a.username}`} className="admin-inline-link">
                {a.displayName}
              </Link>{' '}
              <span className="grant-allocation__handle">@{a.username}</span>
            </span>
            <span className="num grant-allocation__downloads">
              {a.freeDownloads} + {a.paidDownloads}×5
            </span>
            <span className="num">€{a.fanSubEuros}</span>
            <span className="num grant-allocation__units">{a.units.toLocaleString()}</span>
            <span className="num grant-allocation__amount">{formatEur(a.amountCents)}</span>
          </DataRowListRow>
        ))}
        {overflow.length > 0 && (
          <DataRowListRow columns="1fr">
            <span className="grant-allocation__overflow">
              … {overflow.length} more · avg {formatEur(overflowAvgCents)}
            </span>
          </DataRowListRow>
        )}
      </DataRowList>

      <p className="admin-footnote">
        Sum check: allocations {sumCheckOk ? '=' : '≠'} pool to the cent (largest remainder).
        {!sumCheckOk && (
          <span className="admin-footnote--warn"> Mismatch detected — Approve disabled.</span>
        )}{' '}
        Disbursement creates <code>GRANT_DISBURSEMENT</code> ledger entries + public report at{' '}
        <Link href={`/transparency/grants/${year}`}>/transparency/grants/{year}</Link>.
      </p>

      {alreadyRun && history && history.grants.length > 0 && (
        <section className="admin-card" style={{ marginTop: '1.5rem' }}>
          <h2>
            Disbursed — {history.grantCount} recipients · {formatEurFromString(history.totalCents)}
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
                    <td className="num">{formatEurFromString(g.amountCents)}</td>
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
