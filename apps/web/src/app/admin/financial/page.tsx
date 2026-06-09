// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

const SECTIONS = [
  {
    href: '/admin/financial/ledger',
    title: 'Ledger entries',
    desc: 'Record manual revenue and cost entries; browse the period ledger.',
  },
  {
    href: '/admin/financial/fansubs',
    title: 'Fan subscriptions & payout queue',
    desc: 'Active subs, MRR by artist, and pending or failed payouts.',
  },
  {
    href: '/admin/financial/legacy-members',
    title: 'Legacy membership migration queue',
    desc: 'Active members still without a Stripe subscription id.',
  },
  {
    href: '/transparency',
    title: 'Public transparency page',
    desc: 'The public-facing income, cost, and grant transparency report.',
  },
  {
    href: '/api/admin/ledger/export.csv',
    title: 'Export ledger (CSV)',
    desc: 'Download the full ledger as a CSV file.',
  },
  {
    href: '/admin/grants',
    title: 'Grant cycles',
    desc: 'Preview and trigger the annual grant disbursement; view per-artist allocations and disbursement history.',
  },
] as const

export default function AdminFinancialPage() {
  return (
    <>
      <h1 className="admin-section-title">Financial</h1>
      <div className="admin-panel-grid">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="admin-card admin-nav-card">
            <span className="admin-nav-card__title">{s.title}</span>
            <span className="admin-nav-card__desc">{s.desc}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
