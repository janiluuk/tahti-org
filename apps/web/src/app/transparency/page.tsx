// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  KpiCard,
  KpiCardRow,
  Link,
  MoneyCell,
  ProgressBar,
  PublicPageHeader,
  StatCard,
  StatCardGrid,
} from '@tahti/ui'
import { statusPageUrl } from '@/lib/status-page'

interface MonthlyRollup {
  yearMonth: string
  byCategory: Record<string, string>
  surplus: string
  finalizedAt: string | null
}

interface YtdSummary {
  year: string
  byCategory: Record<string, string>
  runningSurplus: string
  monthsFinalized: number
}

interface LedgerEntry {
  id: string
  description: string
  category: string
  amountCents: string
  createdAt: string
}

const LEDGER_ROW_COLUMNS = '70px 1fr 90px 70px'

function formatEur(cents: string | number): string {
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents
  return `€${(n / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatEurSigned(cents: number): string {
  const sign = cents >= 0 ? '+' : '−'
  return `${sign}${formatEur(Math.abs(cents))}`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function categoryLabel(code: string): string {
  const labels: Record<string, string> = {
    REVENUE_SUBSCRIPTION: 'Member subscriptions',
    REVENUE_DISTRIBUTION: 'Distribution fees',
    REVENUE_GRANT_INBOUND: 'Grant income',
    REVENUE_DONATION: 'Donations',
    COST_INFRASTRUCTURE: 'Infrastructure',
    COST_DISTRIBUTION_PASSTHROUGH: 'Distribution pass-through',
    COST_OPERATIONS: 'Operations',
    COST_SALARY: 'Salaries',
    COST_AUDIT: 'Audit & accounting',
    COST_PROFESSIONAL_SERVICES: 'Professional services',
    GRANT_DISBURSEMENT: 'Artist grants paid out',
    RESERVE_TRANSFER: 'Reserve transfers',
    FAN_SUB_GROSS_RECEIVED: 'Fan subscriptions received',
    FAN_SUB_NET_TO_ARTIST: 'Fan-sub payouts to artists',
    FAN_SUB_OPERATIONAL_FEE: 'Fan-sub operations fee',
  }
  return labels[code] ?? code
}

/** Categories that represent money flowing in (rendered green in the ledger). */
const INFLOW_CATEGORIES = new Set([
  'REVENUE_SUBSCRIPTION',
  'REVENUE_DISTRIBUTION',
  'REVENUE_GRANT_INBOUND',
  'REVENUE_DONATION',
  'FAN_SUB_GROSS_RECEIVED',
  'FAN_SUB_OPERATIONAL_FEE',
])

function ledgerEntrySignedCents(entry: LedgerEntry): number {
  const amount = parseInt(entry.amountCents, 10)
  return INFLOW_CATEGORIES.has(entry.category) ? amount : -amount
}

export default async function TransparencyPage() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const statusUrl = statusPageUrl()
  const currentYear = new Date().getFullYear()

  const [ytdRes, rollupRes, resolutionsRes, statsRes, ledgerRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/transparency/ytd`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/transparency/monthly_rollup?year=${currentYear}`, {
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/transparency/resolutions?year=${currentYear}`, {
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/stats`, { next: { revalidate: 300 } }),
    fetch(`${apiUrl}/api/v1/transparency/ledger/latest`, { cache: 'no-store' }),
  ])

  const ytd: YtdSummary = ytdRes.ok
    ? ((await ytdRes.json()) as YtdSummary)
    : {
        year: String(currentYear),
        byCategory: {},
        runningSurplus: '0',
        monthsFinalized: 0,
      }

  const rollups: MonthlyRollup[] = rollupRes.ok ? ((await rollupRes.json()) as MonthlyRollup[]) : []

  const platformStats: {
    activeArtists: number
    totalStorageBytes: number
  } | null = statsRes.ok
    ? ((await statsRes.json()) as { activeArtists: number; totalStorageBytes: number })
    : null

  const resolutions: Array<{
    id: string
    title: string
    body: string
    votedAt: string
    outcome: string
    voteFor: number
    voteAgainst: number
    voteAbstain: number
  }> = resolutionsRes.ok ? await resolutionsRes.json() : []

  const ledgerEntries: LedgerEntry[] = ledgerRes.ok
    ? ((await ledgerRes.json()) as LedgerEntry[])
    : []

  const revenueKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('REVENUE_'))
  const costKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('COST_'))
  const disbKeys = Object.keys(ytd.byCategory).filter(
    (k) => !k.startsWith('REVENUE_') && !k.startsWith('COST_'),
  )

  const totalRevenue = revenueKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)
  const totalCosts = costKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)
  const runningSurplusCents = parseInt(ytd.runningSurplus, 10)

  const grantPoolCents = Math.max(0, Math.round(runningSurplusCents * 0.9))
  const reserveCents = Math.max(0, runningSurplusCents - grantPoolCents)

  return (
    <>
      <PublicPageHeader title="Transparency" back={{ href: '/', label: '← Home' }}>
        Tahti ry is a Finnish registered nonprofit. All income, costs, and artist grants are
        published here. <Link href="/transparency/methodology">Methodology ↗</Link>
        {' · Updated monthly · bylaws §8 · audited annually'}
      </PublicPageHeader>

      <div className="transparency-intro">
        <h3 className="transparency-intro__title">Every euro, visible.</h3>
        <p className="transparency-intro__body">
          Every transaction that moves through Tahti — member subscriptions, hosting costs,
          distribution fees, and artist grants — is recorded in an append-only ledger and published
          here. Nothing is aggregated away before publication.
        </p>
      </div>

      <KpiCardRow aria-label="Year-to-date summary">
        <KpiCard color="cyan" value={formatEur(totalRevenue)} label={`Revenue YTD`} />
        <KpiCard color="coral" value={formatEur(totalCosts)} label={`Costs YTD`} />
        <KpiCard
          color="green"
          value={formatEurSigned(runningSurplusCents)}
          label="Running surplus"
        />
        <KpiCard
          color="purple"
          value={platformStats ? formatBytes(platformStats.totalStorageBytes) : '—'}
          label="Storage used (all artists)"
        />
      </KpiCardRow>

      {ytd.monthsFinalized === 0 && ledgerEntries.length > 0 && (
        <p className="transparency-callout">
          The figures above only include board-approved months, and none are approved yet for{' '}
          {ytd.year} — that&rsquo;s why they read €0,00 even though real transactions are already
          posting. Every entry is visible in the live ledger below the moment it happens.
        </p>
      )}

      <div className="transparency-grid">
        <div>
          <p className="transparency-grid__label">Ledger — latest entries (append-only)</p>
          {ledgerEntries.length === 0 ? (
            <DataRowList>
              <DataRowListEmpty>
                Ledger entries appear here from the first transaction.
              </DataRowListEmpty>
            </DataRowList>
          ) : (
            <DataRowList>
              <DataRowListHeader columns={LEDGER_ROW_COLUMNS}>
                <span>Date</span>
                <span>Entry</span>
                <span>Category</span>
                <span style={{ textAlign: 'right' }}>Amount</span>
              </DataRowListHeader>
              {ledgerEntries.map((entry) => {
                const signedCents = ledgerEntrySignedCents(entry)
                return (
                  <DataRowListRow key={entry.id} columns={LEDGER_ROW_COLUMNS}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
                    <span>{entry.description}</span>
                    <span style={{ textTransform: 'uppercase', color: 'var(--muted2)' }}>
                      {categoryLabel(entry.category)}
                    </span>
                    <MoneyCell value={signedCents}>{formatEurSigned(signedCents)}</MoneyCell>
                  </DataRowListRow>
                )
              })}
            </DataRowList>
          )}
        </div>

        <div>
          <p className="transparency-grid__label">Where surplus goes</p>
          <div className="money-breakdown">
            <ProgressBar
              label="Artist grant pool"
              amount={formatEur(grantPoolCents)}
              percent={90}
              color="green"
            />
            <ProgressBar
              label="Operating reserve"
              amount={formatEur(reserveCents)}
              percent={10}
              color="cyan"
            />
          </div>
          <div className="transparency-callout">
            See exactly how the {currentYear} grant pool was split between artists at{' '}
            <Link href={`/transparency/grants/${currentYear}`}>
              /transparency/grants/{currentYear} →
            </Link>
          </div>
        </div>
      </div>

      <section className="brand-section">
        <h2 className="brand-section__title brand-section-heading">Year-to-date breakdown</h2>
        <CategoryTable title="Revenue" keys={revenueKeys} data={ytd.byCategory} />
        <CategoryTable title="Costs" keys={costKeys} data={ytd.byCategory} />
        {disbKeys.length > 0 && (
          <CategoryTable title="Disbursements" keys={disbKeys} data={ytd.byCategory} />
        )}
      </section>

      {rollups.length > 0 && (
        <section className="brand-section">
          <h2 className="brand-section__title brand-section-heading">Monthly detail</h2>
          <div className="brand-table-wrap">
            <table className="brand-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Revenue</th>
                  <th className="num">Costs</th>
                  <th className="num">Surplus</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rollups.map((r) => {
                  const rev = Object.entries(r.byCategory)
                    .filter(([k]) => k.startsWith('REVENUE_'))
                    .reduce((s, [, v]) => s + parseInt(v, 10), 0)
                  const costs = Object.entries(r.byCategory)
                    .filter(([k]) => k.startsWith('COST_'))
                    .reduce((s, [, v]) => s + parseInt(v, 10), 0)

                  return (
                    <tr key={r.yearMonth}>
                      <td>{r.yearMonth}</td>
                      <td className="num num--revenue">{formatEur(rev)}</td>
                      <td className="num num--cost">{formatEur(costs)}</td>
                      <td className="num">{formatEur(r.surplus)}</td>
                      <td className="brand-muted">{r.finalizedAt ? 'finalized' : 'draft'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rollups.length === 0 && (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No financial data published yet for {ytd.year}.</p>
          <p className="public-empty-card__hint">
            Monthly figures appear here after board approval.{' '}
            <Link href="/transparency/methodology">How we report →</Link>
          </p>
        </div>
      )}

      {resolutions.length > 0 && (
        <section className="brand-section">
          <h2 className="brand-section__title brand-section-heading">
            Board resolutions ({ytd.year})
          </h2>
          <ul className="brand-section">
            {resolutions.map((r) => (
              <li key={r.id} className="brand-card">
                <h3>{r.title}</h3>
                <p className="brand-muted">
                  {r.outcome} · voted {new Date(r.votedAt).toLocaleDateString()} · {r.voteFor}/
                  {r.voteAgainst}/{r.voteAbstain}
                </p>
                <p className="brand-pre-wrap">{r.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {platformStats && (
        <section className="brand-section">
          <h2 className="brand-section__title brand-section-heading">Platform storage</h2>
          <p className="brand-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            Total archive storage used across all artist accounts. We do not enforce hard quotas —
            this figure is published in the spirit of full transparency. See the{' '}
            <Link href="/about">about page</Link> for our storage policy.
          </p>
          <StatCardGrid cols={2}>
            <StatCard
              variant="neutral"
              label="Active artists"
              value={String(platformStats.activeArtists)}
            />
            <StatCard
              variant="neutral"
              label="Total archive storage"
              value={formatBytes(platformStats.totalStorageBytes)}
            />
          </StatCardGrid>
        </section>
      )}

      <footer className="brand-footer">
        <p>
          Tahti ry — Y-tunnus 3368171-8 — Helsinki, Finland
          <br />
          All figures in EUR. Data updated monthly after board approval.{' '}
          <a href="https://github.com/tahtiapp/tahti">Source code (AGPL-3.0)</a>
          {' · '}
          <a href={statusUrl}>Platform status</a>
        </p>
      </footer>
    </>
  )
}

function CategoryTable({
  title,
  keys,
  data,
}: {
  title: string
  keys: string[]
  data: Record<string, string>
}) {
  if (keys.length === 0) return null
  return (
    <div className="brand-category">
      <div className="brand-category__title">{title}</div>
      {keys.map((k) => (
        <div key={k} className="brand-category__row">
          <span>{categoryLabel(k)}</span>
          <span>{formatEur(data[k] ?? '0')}</span>
        </div>
      ))}
    </div>
  )
}
