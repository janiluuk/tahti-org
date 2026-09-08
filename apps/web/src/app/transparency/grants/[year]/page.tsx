// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  KpiCard,
  KpiCardRow,
  Link,
  PublicPageHeader,
  StatusPill,
} from '@tahti/ui'
import { resolveServerApiUrl } from '@/lib/api-url'

export const revalidate = 300

const GRANT_COLUMNS = '1fr 100px 110px 90px'

interface GrantReport {
  year: number
  totalCents: string
  grantCount: number
  disbursedAt: string | null
  grants: Array<{
    publishedAs: string | null
    units: number
    amountCents: string
    state: string
  }>
}

function formatEur(cents: string | number): string {
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents
  if (Number.isNaN(n)) return '€0,00'
  return `€${(n / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseYear(raw: string): number | null {
  const year = Number.parseInt(raw, 10)
  if (!Number.isFinite(year) || year < 2020 || year > 2100) return null
  return year
}

async function fetchGrantReport(year: number): Promise<GrantReport | null> {
  const apiUrl = resolveServerApiUrl()
  try {
    const res = await fetch(`${apiUrl}/api/v1/transparency/grants/${year}`, {
      next: { revalidate: 300 },
    })
    if (res.status === 400 || res.status === 404) return null
    if (!res.ok) return null
    return (await res.json()) as GrantReport
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { year: string }
}): Promise<Metadata> {
  const year = parseYear(params.year)
  if (year == null) return { title: 'Grant report — Tahti' }
  return {
    title: `${year} artist grants — Tahti transparency`,
    description: `Published engagement-unit grant disbursements for ${year}.`,
  }
}

export default async function TransparencyGrantsYearPage({ params }: { params: { year: string } }) {
  const year = parseYear(params.year)
  if (year == null) notFound()

  const report = await fetchGrantReport(year)
  if (!report) notFound()

  const disbursedLabel = report.disbursedAt
    ? new Date(report.disbursedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="transparency-page">
      <PublicPageHeader
        title={`${year} artist grants`}
        back={{ href: '/transparency', label: '← Transparency' }}
      >
        Engagement-unit weighted disbursements from Tahti ry’s annual surplus. Names appear as
        artists chose to publish them.
      </PublicPageHeader>

      <KpiCardRow aria-label={`${year} grant summary`}>
        <KpiCard color="green" value={formatEur(report.totalCents)} label="Total disbursed" />
        <KpiCard color="cyan" value={String(report.grantCount)} label="Artists funded" />
        <KpiCard
          color="amber"
          value={disbursedLabel ?? '—'}
          label={disbursedLabel ? 'Disbursed' : 'Not yet disbursed'}
        />
      </KpiCardRow>

      <section className="brand-section">
        <h2 className="brand-section__title brand-section-heading">
          Disbursements{' '}
          {report.grantCount > 0 ? (
            <StatusPill tone="green">PUBLISHED</StatusPill>
          ) : (
            <StatusPill tone="amber">NO GRANTS YET</StatusPill>
          )}
        </h2>

        <DataRowList aria-label={`${year} grant recipients`}>
          <DataRowListHeader columns={GRANT_COLUMNS}>
            <span>Artist</span>
            <span className="num">Units</span>
            <span className="num">Amount</span>
            <span>State</span>
          </DataRowListHeader>
          {report.grants.length === 0 ? (
            <DataRowListEmpty>
              No grant disbursements have been published for {year} yet.
            </DataRowListEmpty>
          ) : (
            report.grants.map((grant, index) => (
              <DataRowListRow
                key={`${grant.publishedAs ?? 'anon'}-${index}`}
                columns={GRANT_COLUMNS}
              >
                <span>{grant.publishedAs?.trim() || 'Anonymous artist'}</span>
                <span className="num">{grant.units.toLocaleString()}</span>
                <span className="num">{formatEur(grant.amountCents)}</span>
                <span>{grant.state}</span>
              </DataRowListRow>
            ))
          )}
        </DataRowList>
      </section>

      <p className="transparency-callout">
        Methodology and the live ledger are on the{' '}
        <Link href="/transparency">transparency dashboard</Link>. Board CSV exports stay on the
        admin grants tools.
      </p>
    </div>
  )
}
