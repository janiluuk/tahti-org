// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Link, PublicPageHeader, StatCard, StatCardGrid } from '@tahti/ui'
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

function formatEur(cents: string | number): string {
  const n = typeof cents === 'string' ? parseInt(cents, 10) : cents
  return `€${(n / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  }
  return labels[code] ?? code
}

export default async function TransparencyPage() {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const statusUrl = statusPageUrl()

  const [ytdRes, rollupRes, resolutionsRes, statsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/transparency/ytd`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/transparency/monthly_rollup?year=${new Date().getFullYear()}`, {
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/transparency/resolutions?year=${new Date().getFullYear()}`, {
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/stats`, { next: { revalidate: 300 } }),
  ])

  const ytd: YtdSummary = ytdRes.ok
    ? ((await ytdRes.json()) as YtdSummary)
    : {
        year: String(new Date().getFullYear()),
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

  const revenueKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('REVENUE_'))
  const costKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('COST_'))
  const disbKeys = Object.keys(ytd.byCategory).filter(
    (k) => !k.startsWith('REVENUE_') && !k.startsWith('COST_'),
  )

  const totalRevenue = revenueKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)
  const totalCosts = costKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)

  return (
    <>
      <PublicPageHeader title="Transparency" back={{ href: '/', label: '← Home' }}>
        Tahti ry is a Finnish registered nonprofit. All income, costs, and artist grants are
        published here. <Link href="/transparency/methodology">Methodology ↗</Link>
      </PublicPageHeader>

      <StatCardGrid cols={3} aria-label="Year-to-date summary">
        <StatCard
          variant="revenue"
          label={`${ytd.year} Revenue`}
          value={formatEur(totalRevenue)}
          positive
        />
        <StatCard variant="cost" label={`${ytd.year} Costs`} value={formatEur(totalCosts)} />
        <StatCard
          variant="surplus"
          label="Running surplus"
          value={formatEur(ytd.runningSurplus)}
          positive={parseInt(ytd.runningSurplus, 10) >= 0}
          subtitle={`${ytd.monthsFinalized} month${ytd.monthsFinalized !== 1 ? 's' : ''} finalized`}
        />
      </StatCardGrid>

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
