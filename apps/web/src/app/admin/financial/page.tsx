// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export default function AdminFinancialPage() {
  return (
    <>
      <h1 className="admin-section-title">Financial</h1>
      <ul className="admin-link-list">
        <li>
          <Link href="/transparency">Public transparency page</Link>
        </li>
        <li>
          <a href="/api/admin/ledger/export.csv">Export ledger (CSV)</a>
        </li>
        <li>
          <Link href="/governance">Grant preview &amp; run (governance portal)</Link>
        </li>
      </ul>
      <p className="admin-stat-sub" style={{ marginTop: '1.5rem' }}>
        Full ledger UI, grant disbursement, and fan-sub payout queue are planned in Phase 12 M21-D.
      </p>
    </>
  )
}
