'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DASHBOARD_NAV } from './dashboard-nav'
import { SidebarNavIconSvg } from './SidebarNav'

function IconChannel() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 11 Q8 5 14 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 13 Q8 8 12 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4" r="1.25" fill="currentColor" />
    </svg>
  )
}
function IconStats() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="9" width="3" height="5" rx="0.75" fill="currentColor" opacity=".6" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.75" fill="currentColor" opacity=".8" />
      <rect x="11" y="2" width="3" height="12" rx="0.75" fill="currentColor" />
    </svg>
  )
}
function IconArchive() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M1.5 3.5h5l1.5 1.5H14.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconRevenue() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 5v6M6 6.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5S9.33 8 8.5 8h-1C6.67 8 6 8.67 6 9.5S6.67 11 7.5 11h1c.83 0 1.5-.67 1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.5v1.75M8 12.75V14.5M1.5 8h1.75M12.75 8H14.5M3.4 3.4l1.24 1.24M11.36 11.36l1.24 1.24M12.6 3.4l-1.24 1.24M4.64 11.36l-1.24 1.24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.5v7M5.5 5 8 2.5 10.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconCollections() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="4" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="4" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5.5" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const MOBILE_NAV = [
  { href: '/dashboard', label: 'Channel', Icon: IconChannel },
  { href: '/dashboard/stats', label: 'Stats', Icon: IconStats },
  { href: '/dashboard/archive', label: 'Archive', Icon: IconArchive, requiresChannel: true },
  { href: '/dashboard/upload', label: 'Upload', Icon: IconUpload },
  { href: '/dashboard/collections', label: 'Collections', Icon: IconCollections },
  { href: '/dashboard/revenue', label: 'Revenue', Icon: IconRevenue },
  { href: '/dashboard/settings/account', label: 'Settings', Icon: IconSettings },
]

function IconMore() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

const PRIMARY_HREFS = new Set(MOBILE_NAV.map((item) => item.href))

/** Mobile bottom nav for the dashboard (hidden on desktop). The bar itself only
 * has room for a handful of items — everything else in DASHBOARD_NAV (the same
 * list the desktop sidebar renders) surfaces behind "More" so nothing is
 * reachable on desktop but stranded on mobile. */
export function StudioMobileNav({
  hasChannel = true,
  isBoard = false,
}: {
  hasChannel?: boolean
  isBoard?: boolean
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const moreItems = DASHBOARD_NAV.filter((item) => {
    if (item.adminOnly && !isBoard) return false
    if (item.requiresChannel && !hasChannel) return false
    if (PRIMARY_HREFS.has(item.href)) return false
    // Mobile's "Settings" points at /settings/account; skip the sidebar's plain /settings row too.
    if (item.href === '/dashboard/settings') return false
    return true
  })

  return (
    <>
      {moreOpen && (
        <div
          className="db-mobile-more-overlay"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="db-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More dashboard sections"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="db-mobile-more-sheet__handle" aria-hidden />
            <div className="db-mobile-more-sheet__grid">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="db-mobile-more-sheet__item"
                  onClick={() => setMoreOpen(false)}
                >
                  <SidebarNavIconSvg name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="db-mobile-nav" aria-label="Mobile navigation">
        {MOBILE_NAV.filter((item) => !item.requiresChannel || hasChannel).map(
          ({ href, label, Icon }) => {
            // `/dashboard` is a path prefix of every other dashboard route, so it can only
            // ever match exactly — a startsWith check here would light up Channel everywhere.
            const active =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={label}
                href={href}
                className={`db-mobile-nav-item${active ? ' active' : ''}`}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            )
          },
        )}
        {moreItems.length > 0 && (
          <button
            type="button"
            className={`db-mobile-nav-item db-mobile-nav-item--button${moreOpen ? ' active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <IconMore />
            <span>More</span>
          </button>
        )}
      </nav>
    </>
  )
}
