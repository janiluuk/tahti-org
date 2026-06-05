// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'

export default function MethodologyPage() {
  return (
    <div className="brand-prose">
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
        <dl>
          <dt>REVENUE_SUBSCRIPTION</dt>
          <dd>
            Monthly membership fees from artist members (Artist and Studio tiers). Recorded at
            successful Stripe charge.
          </dd>
          <dt>REVENUE_DISTRIBUTION</dt>
          <dd>
            Distribution handling fees charged to artists for Revelator/DSP delivery (€3–5 per
            release). Pass-through cost is recorded separately.
          </dd>
          <dt>REVENUE_GRANT_INBOUND</dt>
          <dd>Grants received from public or private bodies (e.g. Taiteen edistämiskeskus).</dd>
          <dt>REVENUE_DONATION</dt>
          <dd>Voluntary donations from supporters.</dd>
        </dl>
      </section>

      <section className="brand-section">
        <Heading level={2}>Cost categories</Heading>
        <dl>
          <dt>COST_INFRASTRUCTURE</dt>
          <dd>
            Servers, bandwidth, colocation, domain registrations, TLS certificates, cloud services.
            Primarily owned hardware in Helsinki.
          </dd>
          <dt>COST_DISTRIBUTION_PASSTHROUGH</dt>
          <dd>Revelator API cost passed directly through to artists. Net zero for Tahti ry.</dd>
          <dt>COST_OPERATIONS</dt>
          <dd>
            Payment processing fees (Stripe), subscriptions, software licenses, office materials.
          </dd>
          <dt>COST_SALARY</dt>
          <dd>
            Board compensation and any paid professional roles. Published in aggregate, never
            per-person.
          </dd>
          <dt>COST_AUDIT</dt>
          <dd>
            Annual statutory audit and accounting fees. Finnish associations law requires annual
            audit above certain thresholds.
          </dd>
          <dt>COST_PROFESSIONAL_SERVICES</dt>
          <dd>Legal advice, translation, ad-hoc consulting.</dd>
        </dl>
      </section>

      <section className="brand-section">
        <Heading level={2}>Disbursements</Heading>
        <dl>
          <dt>GRANT_DISBURSEMENT</dt>
          <dd>
            Annual artist grants paid to member channels. Calculated March 1 for the prior calendar
            year. Formula: (channel engagement units / total eligible units) × grant&nbsp;pool. A
            10% operating reserve is retained before the pool is calculated.
          </dd>
          <dt>RESERVE_TRANSFER</dt>
          <dd>
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
    </div>
  )
}
