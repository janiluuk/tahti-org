// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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

  const [ytdRes, rollupRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/transparency/ytd`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/transparency/monthly_rollup?year=${new Date().getFullYear()}`, {
      cache: 'no-store',
    }),
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

  const revenueKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('REVENUE_'))
  const costKeys = Object.keys(ytd.byCategory).filter((k) => k.startsWith('COST_'))
  const disbKeys = Object.keys(ytd.byCategory).filter(
    (k) => !k.startsWith('REVENUE_') && !k.startsWith('COST_'),
  )

  const totalRevenue = revenueKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)
  const totalCosts = costKeys.reduce((s, k) => s + parseInt(ytd.byCategory[k] ?? '0', 10), 0)

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '3rem auto',
        padding: '0 1rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: '0.25rem' }}>Transparency</h1>
      <p style={{ color: '#666', marginBottom: '2.5rem' }}>
        Tahti ry is a Finnish registered nonprofit. All income, costs, and artist grants are
        published here.{' '}
        <a href="/transparency/methodology" style={{ color: '#555' }}>
          Methodology ↗
        </a>
      </p>

      {/* YTD summary cards */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        <SummaryCard label={`${ytd.year} Revenue`} value={formatEur(totalRevenue)} positive />
        <SummaryCard label={`${ytd.year} Costs`} value={formatEur(totalCosts)} />
        <SummaryCard
          label="Running surplus"
          value={formatEur(ytd.runningSurplus)}
          positive={parseInt(ytd.runningSurplus, 10) >= 0}
          subtitle={`${ytd.monthsFinalized} month${ytd.monthsFinalized !== 1 ? 's' : ''} finalized`}
        />
      </section>

      {/* Category breakdown */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1rem', color: '#444', marginBottom: '0.75rem', fontWeight: 600 }}>
          Year-to-date breakdown
        </h2>
        <CategoryTable title="Revenue" keys={revenueKeys} data={ytd.byCategory} />
        <CategoryTable title="Costs" keys={costKeys} data={ytd.byCategory} />
        {disbKeys.length > 0 && (
          <CategoryTable title="Disbursements" keys={disbKeys} data={ytd.byCategory} />
        )}
      </section>

      {/* Monthly rollup table */}
      {rollups.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1rem', color: '#444', marginBottom: '0.75rem', fontWeight: 600 }}>
            Monthly detail
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>Month</th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#666', textAlign: 'right' }}>
                    Revenue
                  </th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#666', textAlign: 'right' }}>
                    Costs
                  </th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#666', textAlign: 'right' }}>
                    Surplus
                  </th>
                  <th style={{ padding: '0.5rem 0.75rem', color: '#666' }}>Status</th>
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
                    <tr key={r.yearMonth} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{r.yearMonth}</td>
                      <td
                        style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#16a34a' }}
                      >
                        {formatEur(rev)}
                      </td>
                      <td
                        style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#dc2626' }}
                      >
                        {formatEur(costs)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                        {formatEur(r.surplus)}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#888', fontSize: '0.8rem' }}>
                        {r.finalizedAt ? 'finalized' : 'draft'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rollups.length === 0 && (
        <p style={{ color: '#aaa', marginTop: '2rem', textAlign: 'center' }}>
          No financial data published yet for {ytd.year}.
        </p>
      )}

      <footer
        style={{
          marginTop: '3rem',
          borderTop: '1px solid #eee',
          paddingTop: '1.5rem',
          color: '#aaa',
          fontSize: '0.8rem',
        }}
      >
        <p>
          Tahti ry — Y-tunnus 3368171-8 — Helsinki, Finland
          <br />
          All figures in EUR. Data updated monthly after board approval.{' '}
          <a href="https://github.com/tahtiapp/tahti" style={{ color: '#999' }}>
            Source code (AGPL-3.0)
          </a>
        </p>
      </footer>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  positive,
  subtitle,
}: {
  label: string
  value: string
  positive?: boolean
  subtitle?: string
}) {
  return (
    <div style={{ padding: '1rem 1.25rem', border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: positive ? '#16a34a' : '#111' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.15rem' }}>{subtitle}</div>
      )}
    </div>
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
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          fontSize: '0.8rem',
          color: '#888',
          fontWeight: 600,
          marginBottom: '0.25rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </div>
      {keys.map((k) => (
        <div
          key={k}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.3rem 0',
            borderBottom: '1px solid #f5f5f5',
          }}
        >
          <span style={{ color: '#444', fontSize: '0.875rem' }}>{categoryLabel(k)}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem' }}>
            {formatEur(data[k] ?? '0')}
          </span>
        </div>
      ))}
    </div>
  )
}
