'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export interface AdminShellHeaderProps {
  displayName: string
  userInitial: string
}

/** Production admin top bar — pairs with AdminShell `variant="studio"`. */
export function AdminShellHeader({ displayName, userInitial }: AdminShellHeaderProps) {
  return (
    <>
      <div className="admin-view-strip" role="status" aria-live="polite">
        ADMIN VIEW · {displayName}
      </div>
      <header className="studio-top-nav">
        <Link href="/admin/dashboard" className="studio-top-nav__logo admin-top-logo">
          TAHTI ADMIN
        </Link>
        <div className="studio-top-nav__actions">
          <div className="studio-top-nav__user" aria-label={`Signed in as ${displayName}`}>
            <span className="studio-top-nav__user-avatar admin-user-avatar" aria-hidden>
              {userInitial}
            </span>
            <span className="studio-top-nav__user-name">{displayName}</span>
          </div>
          <Link href="/dashboard" className="studio-top-nav__link">
            Artist dashboard
          </Link>
          <Link href="/governance" className="studio-top-nav__link">
            Governance
          </Link>
        </div>
      </header>
    </>
  )
}
