// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

const SECTIONS = [
  {
    href: '/governance',
    title: 'Member motions & voting',
    desc: 'Open member motions and the public governance portal.',
  },
  {
    href: '/governance/venues',
    title: 'Venue verification queue',
    desc: 'Review and verify venue submissions for the events calendar.',
  },
  {
    href: '/admin/governance/report',
    title: 'Annual report generator',
    desc: 'Generate and store the yearly nonprofit activity report.',
  },
  {
    href: '/admin/governance/resolutions',
    title: 'Board resolutions',
    desc: 'Record and publish formal board decisions and vote outcomes.',
  },
  {
    href: '/admin/agm',
    title: 'Annual General Meeting',
    desc: 'Agenda builder, open motions, member notice checklist, and minutes links.',
  },
  {
    href: '/admin/governance/audit',
    title: 'Audit log viewer',
    desc: 'Searchable log of privileged actions across the platform.',
  },
  {
    href: '/api/admin/audit/export.csv',
    title: 'Audit log export (CSV)',
    desc: 'Download the full audit trail as a CSV file.',
  },
  {
    href: '/api/admin/members/export.csv',
    title: 'Member register export (CSV)',
    desc: 'Download the member register as a CSV file.',
  },
] as const

export default function AdminGovernancePage() {
  return (
    <>
      <h1 className="admin-section-title">Governance</h1>
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
