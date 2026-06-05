// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export default function AdminGovernancePage() {
  return (
    <>
      <h1 className="admin-section-title">Governance</h1>
      <ul className="admin-link-list">
        <li>
          <Link href="/governance">Member motions &amp; voting</Link>
        </li>
        <li>
          <Link href="/governance/venues">Venue verification queue</Link>
        </li>
        <li>
          <a href="/api/admin/audit/export.csv">Audit log export (CSV)</a>
        </li>
        <li>
          <a href="/api/admin/members/export.csv">Member register export (CSV)</a>
        </li>
      </ul>
    </>
  )
}
