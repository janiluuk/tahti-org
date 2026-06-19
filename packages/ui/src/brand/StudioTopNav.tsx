'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { navigateDashboardHash } from './dashboard-nav'
import { SidebarNavIconSvg } from './SidebarNav'

type StudioTopNavProps = {
  displayName?: string
  isLive?: boolean
  isBoard?: boolean
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 11 14 8l-3.5-3M14 8H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSwitch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 5.5h9.5M8.75 2.75 11.5 5.5 8.75 8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10.5H4.5M7.25 7.75 4.5 10.5l2.75 2.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** PLAT-020: dashboard top bar — TAHTI logo + user menu (settings, log out, admin switch). */
export function StudioTopNav({ displayName, isLive, isBoard }: StudioTopNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : null
  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  function onSettingsClick(e: MouseEvent<HTMLAnchorElement>) {
    setOpen(false)
    if (!onDashboard) return
    e.preventDefault()
    navigateDashboardHash('#account')
  }

  return (
    <header className="studio-top-nav">
      <Link href="/" className="studio-top-nav__logo">
        TAHTI
      </Link>
      <div className="studio-top-nav__actions">
        {isBoard && (
          <Link href="/admin" className="studio-top-nav__link studio-top-nav__link--admin">
            <IconSwitch />
            Switch to admin
          </Link>
        )}
        {displayName && (
          <div className="studio-top-nav__user-menu" ref={menuRef}>
            <button
              type="button"
              className="studio-top-nav__user"
              aria-label={`Signed in as ${displayName}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {isLive && <span className="signal-dot studio-top-nav__live-dot" aria-hidden />}
              <span className="studio-top-nav__user-avatar" aria-hidden>
                {initial}
              </span>
              <span className="studio-top-nav__user-name">{displayName}</span>
              <span className="studio-top-nav__user-caret" aria-hidden>
                {open ? '▴' : '▾'}
              </span>
            </button>
            {open && (
              <div className="studio-top-nav__menu" role="menu">
                <Link
                  href="/dashboard#account"
                  className="studio-top-nav__menu-item"
                  role="menuitem"
                  onClick={onSettingsClick}
                >
                  <SidebarNavIconSvg name="settings" />
                  Settings
                </Link>
                <div className="studio-top-nav__menu-divider" role="separator" />
                <form action="/api/auth/logout" method="POST" className="studio-top-nav__menu-form">
                  <button
                    type="submit"
                    className="studio-top-nav__menu-item studio-top-nav__menu-item--danger"
                    role="menuitem"
                  >
                    <IconLogout />
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
