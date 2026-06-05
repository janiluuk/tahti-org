// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

export default function MethodologyPage() {
  return (
    <>
      <Heading level={1}>Transparency methodology</Heading>
      <Text tone="muted">
        How Tahti ry records and publishes its financial data.{' '}
        <Link href="/transparency">← Back to transparency dashboard</Link>
      </Text>

      <section className="brand-section">
        <Heading level={2}>Principles</Heading>
        <p>
          Tahti ry is a Finnish registered nonprofit association (yhdistys, Y-tunnus 3368171-8). All
          income and expenditure is accounted for and published here monthly after board approval.
          Data is final once a month is marked &ldquo;finalized&rdquo;.
        </p>
        <p>
          The goal is radical transparency: any member or interested party can verify that the
          organisation runs at cost, surpluses are returned to artists, and no hidden fees exist.
        </p>
      </section>

      <section className="brand-section">
        <Heading level={2}>Revenue categories</Heading>
        <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0.5rem 1rem' }}>
          <dt style={{ fontWeight: 600, color: '#444' }}>REVENUE_SUBSCRIPTION</dt>
          <dd style={{ margin: 0 }}>
            Monthly membership fees from artist members (Artist and Studio tiers). Recorded at
            successful Stripe charge.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>REVENUE_DISTRIBUTION</dt>
          <dd style={{ margin: 0 }}>
            Distribution handling fees charged to artists for Revelator/DSP delivery (€3–5 per
            release). Pass-through cost is recorded separately.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>REVENUE_GRANT_INBOUND</dt>
          <dd style={{ margin: 0 }}>
            Grants received from public or private bodies (e.g. Taiteen edistämiskeskus).
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>REVENUE_DONATION</dt>
          <dd style={{ margin: 0 }}>Voluntary donations from supporters.</dd>
        </dl>
      </section>

      <section className="brand-section">
        <Heading level={2}>Cost categories</Heading>
        <dl style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '0.5rem 1rem' }}>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_INFRASTRUCTURE</dt>
          <dd style={{ margin: 0 }}>
            Servers, bandwidth, colocation, domain registrations, TLS certificates, cloud services.
            Primarily owned hardware in Helsinki.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_DISTRIBUTION_PASSTHROUGH</dt>
          <dd style={{ margin: 0 }}>
            Revelator API cost passed directly through to artists. Net zero for Tahti ry.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_OPERATIONS</dt>
          <dd style={{ margin: 0 }}>
            Payment processing fees (Stripe), subscriptions, software licenses, office materials.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_SALARY</dt>
          <dd style={{ margin: 0 }}>
            Board compensation and any paid professional roles. Published in aggregate, never
            per-person.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_AUDIT</dt>
          <dd style={{ margin: 0 }}>
            Annual statutory audit and accounting fees. Finnish associations law requires annual
            audit above certain thresholds.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>COST_PROFESSIONAL_SERVICES</dt>
          <dd style={{ margin: 0 }}>Legal advice, translation, ad-hoc consulting.</dd>
        </dl>
      </section>

      <section className="brand-section">
        <Heading level={2}>Disbursements</Heading>
        <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0.5rem 1rem' }}>
          <dt style={{ fontWeight: 600, color: '#444' }}>GRANT_DISBURSEMENT</dt>
          <dd style={{ margin: 0 }}>
            Annual artist grants paid to member channels. Calculated March 1 for the prior calendar
            year. Formula: (channel engagement units / total eligible units) × grant&nbsp;pool. A
            10% operating reserve is retained before the pool is calculated.
          </dd>
          <dt style={{ fontWeight: 600, color: '#444' }}>RESERVE_TRANSFER</dt>
          <dd style={{ margin: 0 }}>
            Movements to or from the operating reserve fund. The reserve target is 3 months of
            operating costs.
          </dd>
        </dl>
      </section>

      <section className="brand-section">
        <Heading level={2}>How surplus is calculated</Heading>
        <p>
          Surplus = total revenue − total costs (including salaries and professional services).
          Disbursements and reserve transfers are not costs — they are allocations of the surplus.
          The running surplus shown on the dashboard is revenue minus costs only; it does not yet
          subtract planned grant disbursements.
        </p>
      </section>

      <section className="brand-section">
        <Heading level={2}>Engagement units (grant formula)</Heading>
        <p>
          Grants are allocated proportionally by <em>engagement units</em>, not passive
          listener-hours. An engagement unit is a weighted measure that rewards listener commitment:
        </p>
        <ul>
          <li>
            <strong>Download</strong> of a free track = 1 unit (listener committed enough to
            download)
          </li>
          <li>
            <strong>Fan subscription</strong> = engagement_euros × multiplier (fan paid real money)
          </li>
        </ul>
        <p>
          Passive streaming (HLS playback) does not generate engagement units. This prevents gaming
          via bots or loop plays. See <code>docs/engagement-and-fansubs.md</code> in the source
          repository for full formula details.
        </p>
      </section>

      <section className="brand-section">
        <Heading level={2}>Data pipeline</Heading>
        <ol>
          <li>
            Stripe webhooks automatically create <code>REVENUE_SUBSCRIPTION</code> entries.
          </li>
          <li>
            The treasurer manually enters infrastructure invoices, salary, and other costs via the
            admin panel. All entries are audit-logged.
          </li>
          <li>
            On the first of each month a background job aggregates the prior month into a finalized{' '}
            <code>MonthlyRollup</code> row. The treasurer marks it finalized after board review.
          </li>
          <li>
            All data is immediately available via the public read-only API at{' '}
            <code>/api/v1/transparency/</code>.
          </li>
        </ol>
      </section>

      <section className="brand-section">
        <Heading level={2}>Public API</Heading>
        <p>All endpoints return JSON and are CORS-open for third-party use.</p>
        <ul>
          <li>
            <code>GET /api/v1/transparency/monthly_rollup?year=YYYY</code> — all finalized month
            rollups for a given year
          </li>
          <li>
            <code>GET /api/v1/transparency/ytd</code> — current year running totals
          </li>
          <li>
            <code>GET /api/v1/transparency/categories</code> — category descriptions
          </li>
        </ul>
      </section>

      <footer className="brand-footer">
        <p>
          Tahti ry — Y-tunnus 3368171-8 — Helsinki, Finland.{' '}
          <a href="https://github.com/tahtiapp/tahti">Source code (AGPL-3.0)</a>
        </p>
      </footer>
    </>
  )
}
