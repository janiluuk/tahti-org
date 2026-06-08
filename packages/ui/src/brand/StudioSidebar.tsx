'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function IconChannel() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 11 Q8 5 14 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 13 Q8 8 12 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4" r="1.25" fill="currentColor" />
    </svg>
  )
}
function IconStats() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="9" width="3" height="5" rx="0.75" fill="currentColor" opacity=".6" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.75" fill="currentColor" opacity=".8" />
      <rect x="11" y="2" width="3" height="12" rx="0.75" fill="currentColor" />
    </svg>
  )
}
function IconEditor() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <line
        x1="3"
        y1="4"
        x2="13"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="4" r="2" fill="currentColor" />
      <line
        x1="3"
        y1="9"
        x2="13"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="9" r="2" fill="currentColor" />
      <line
        x1="3"
        y1="14"
        x2="13"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="5" cy="14" r="2" fill="currentColor" />
    </svg>
  )
}
function IconStash() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="6" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 6V4.5a3 3 0 0 1 6 0V6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="10.5" r="1.25" fill="currentColor" />
    </svg>
  )
}
function IconArchive() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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
function IconLinks() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.77-1.77a3.5 3.5 0 0 0-4.95-4.95l-.88.88"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.78 8.27a3.5 3.5 0 0 0 4.95 4.95l.88-.88"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
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

const ROUTE_ITEMS = [
  { href: '/dashboard', label: 'Channel', Icon: IconChannel, match: '/dashboard' },
  { href: '/dashboard/stats', label: 'Stats', Icon: IconStats, match: '/dashboard/stats' },
  { href: '/dashboard/editor', label: 'Editor', Icon: IconEditor, match: '/dashboard/editor' },
  { href: '/dashboard/stash', label: 'Stash', Icon: IconStash, match: '/dashboard/stash' },
] as const

const HASH_ITEMS = [
  { href: '/dashboard#overview', label: 'Overview', Icon: IconChannel, hash: '#overview' },
  {
    href: '/dashboard#broadcast',
    label: 'Broadcast',
    Icon: IconSettings,
    hash: '#broadcast',
  },
  {
    href: '/dashboard#catalog',
    label: 'Catalog',
    Icon: IconArchive,
    hash: '#catalog',
  },
  { href: '/dashboard#audience', label: 'Audience', Icon: IconRevenue, hash: '#audience' },
  {
    href: '/dashboard#account',
    label: 'Account',
    Icon: IconLinks,
    hash: '#account',
  },
] as const

const HASH_TAB_ALIASES: Record<string, string> = {
  'studio-overview': 'overview',
  'studio-stats': 'overview',
  'studio-settings': 'broadcast',
  'studio-distribution': 'broadcast',
  'studio-releases': 'catalog',
  'studio-archive': 'catalog',
  'studio-fans': 'audience',
  'studio-newsletter': 'audience',
}

function tabFromHash(raw: string): string {
  const key = raw.replace(/^#/, '')
  if (!key) return 'overview'
  return HASH_TAB_ALIASES[key] ?? key
}

/** PLAT-020 / PLAT-030: dashboard sidebar — routes + hash anchors on the main page. */
export function StudioSidebar() {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'

  return (
    <aside className="db-sidebar">
      <nav aria-label="Dashboard sections">
        {ROUTE_ITEMS.map(({ href, label, Icon, match }) => {
          const active =
            match === '/dashboard'
              ? onDashboard &&
                (hash === '' ||
                  hash === '#overview' ||
                  hash === '#studio-overview' ||
                  hash === '#studio-stats')
              : pathname === match || pathname.startsWith(`${match}/`)
          return (
            <Link key={href} href={href} className={`db-nav-item${active ? ' active' : ''}`}>
              <Icon />
              {label}
            </Link>
          )
        })}
        {onDashboard && <div className="db-nav-group-label">Sections</div>}
        {onDashboard &&
          HASH_ITEMS.map(({ href, label, Icon, hash: itemHash }) => {
            const active = tabFromHash(hash) === tabFromHash(itemHash)
            return (
              <Link key={href} href={href} className={`db-nav-item${active ? ' active' : ''}`}>
                <Icon />
                {label}
              </Link>
            )
          })}
      </nav>
    </aside>
  )
}
