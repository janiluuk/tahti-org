'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { HelpTourButton } from './HelpTourButton'
import { getAdminTourSteps } from './tour-steps'

export interface AdminShellHeaderProps {
  displayName: string
  username: string
  userInitial: string
}

/** Production admin top bar — pairs with AdminShell `variant="studio"`. */
export function AdminShellHeader({ displayName, username, userInitial }: AdminShellHeaderProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <div className="admin-view-strip" role="status" aria-live="polite">
        ⚠ ADMIN VIEW · acting as board member @{username} · all actions audit-logged
      </div>
      <header className="studio-top-nav">
        <div className="studio-top-nav__brand">
          <Link href="/admin/dashboard" className="studio-top-nav__logo admin-top-logo">
            TAHTI ADMIN
          </Link>
          <HelpTourButton
            steps={getAdminTourSteps(pathname ?? '/admin/dashboard')}
            className="studio-top-nav__icon-btn studio-top-nav__help-btn"
          />
        </div>
        <div className="studio-top-nav__actions">
          <div className="studio-top-nav__user-menu" ref={menuRef}>
            <button
              type="button"
              className="studio-top-nav__user"
              aria-label={`Signed in as ${displayName}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <span className="studio-top-nav__user-avatar admin-user-avatar" aria-hidden>
                {userInitial}
              </span>
              <span className="studio-top-nav__user-name">{displayName}</span>
              <span className="studio-top-nav__user-caret" aria-hidden>
                {open ? '▴' : '▾'}
              </span>
            </button>
            {open && (
              <div className="studio-top-nav__menu" role="menu">
                <Link
                  href="/dashboard"
                  className="studio-top-nav__menu-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  Switch to artist
                </Link>
              </div>
            )}
          </div>
          <Link href="/dashboard/governance" className="studio-top-nav__link">
            Governance portal
          </Link>
        </div>
      </header>
    </>
  )
}
