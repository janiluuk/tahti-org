// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

type StudioTopNavProps = {
  displayName?: string
  isLive?: boolean
}

/** PLAT-020: dashboard top bar — TAHTI logo + studio links. */
export function StudioTopNav({ displayName, isLive }: StudioTopNavProps) {
  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : null

  return (
    <header className="studio-top-nav">
      <Link href="/" className="studio-top-nav__logo">
        TAHTI
      </Link>
      <div className="studio-top-nav__actions">
        {displayName && (
          <div className="studio-top-nav__user" aria-label={`Signed in as ${displayName}`}>
            {isLive && <span className="signal-dot studio-top-nav__live-dot" aria-hidden />}
            <span className="studio-top-nav__user-avatar" aria-hidden>
              {initial}
            </span>
            <span className="studio-top-nav__user-name">{displayName}</span>
          </div>
        )}
        <Link href="/governance" className="studio-top-nav__link">
          Governance
        </Link>
        <Link href="/admin" className="studio-top-nav__link">
          Admin
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
