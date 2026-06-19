'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type MouseEvent } from 'react'
import { isDashboardNavItemActive, navigateDashboardHash } from './dashboard-nav'

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

const MOBILE_NAV = [
  {
    href: '/dashboard#overview',
    label: 'Channel',
    Icon: IconChannel,
    hash: '#overview',
    sectionKey: 'overview' as const,
  },
  { href: '/dashboard/stats', label: 'Stats', Icon: IconStats },
  {
    href: '/dashboard#archive',
    label: 'Archive',
    Icon: IconArchive,
    hash: '#archive',
    sectionKey: 'archive' as const,
    requiresChannel: true,
  },
  {
    href: '/dashboard#newsletter',
    label: 'Revenue',
    Icon: IconRevenue,
    hash: '#newsletter',
    sectionKey: 'newsletter' as const,
    requiresChannel: true,
  },
  {
    href: '/dashboard#account',
    label: 'Settings',
    Icon: IconSettings,
    hash: '#account',
    sectionKey: 'account' as const,
  },
]

/** Mobile bottom nav for the dashboard (hidden on desktop). */
export function StudioMobileNav({ hasChannel = true }: { hasChannel?: boolean }) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [pathname])

  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'

  function onHashNavClick(e: MouseEvent<HTMLAnchorElement>, itemHash: string) {
    if (!onDashboard) return
    e.preventDefault()
    navigateDashboardHash(itemHash)
  }

  return (
    <nav className="db-mobile-nav" aria-label="Mobile navigation">
      {MOBILE_NAV.filter((item) => !item.requiresChannel || hasChannel).map(
        ({ href, label, Icon, hash: itemHash, sectionKey }) => {
          let active: boolean
          if (itemHash && sectionKey) {
            active = isDashboardNavItemActive(hash, { sectionKey, hash: itemHash }, onDashboard)
          } else {
            active = pathname === href || pathname.startsWith(`${href}/`)
          }
          return (
            <Link
              key={label}
              href={href}
              className={`db-mobile-nav-item${active ? ' active' : ''}`}
              onClick={itemHash ? (e) => onHashNavClick(e, itemHash) : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          )
        },
      )}
    </nav>
  )
}
