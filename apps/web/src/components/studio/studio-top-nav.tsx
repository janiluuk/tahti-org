// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

/** PLAT-020: dashboard top bar — TAHTI logo + studio links. */
export function StudioTopNav() {
  return (
    <header className="studio-top-nav">
      <Link href="/" className="studio-top-nav__logo">
        TAHTI
      </Link>
      <div className="studio-top-nav__actions">
        <Link href="/governance" className="studio-top-nav__link">
          Governance
        </Link>
        <Link href="/transparency" className="studio-top-nav__link">
          Transparency
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="studio-top-nav__logout">
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
