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
function IconNewsletter() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6l6 4 6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
function IconDistribution() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2L9.5 6.5H14L10.25 9.25L11.5 14L8 11.5L4.5 14L5.75 9.25L2 6.5H6.5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        fill="none"
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
function IconAdmin() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2L13.5 4.5V9c0 2.5-2.25 4.5-5.5 5-3.25-.5-5.5-2.5-5.5-5V4.5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type NavItem = {
  href: string
  label: string
  Icon: () => JSX.Element
  isRoute?: boolean
  hash?: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Channel', Icon: IconChannel, isRoute: true },
  { href: '/dashboard/stats', label: 'Stats', Icon: IconStats, isRoute: true },
  { href: '/dashboard#catalog', label: 'Archive', Icon: IconArchive, hash: '#catalog' },
  { href: '/dashboard#audience', label: 'Revenue', Icon: IconRevenue, hash: '#audience' },
  { href: '/dashboard#audience', label: 'Newsletter', Icon: IconNewsletter, hash: '#audience' },
  { href: '/dashboard#catalog', label: 'Smart Links', Icon: IconLinks, hash: '#catalog' },
  {
    href: '/dashboard#broadcast',
    label: 'Distribution',
    Icon: IconDistribution,
    hash: '#broadcast',
  },
  { href: '/dashboard#account', label: 'Settings', Icon: IconSettings, hash: '#account' },
  { href: '/dashboard/stash', label: 'Stash', Icon: IconStash, isRoute: true },
  { href: '/admin', label: 'Admin', Icon: IconAdmin, isRoute: true, adminOnly: true },
]

const HASH_ALIASES: Record<string, string> = {
  'studio-overview': '',
  'studio-stats': '',
  'studio-settings': '#broadcast',
  'studio-distribution': '#broadcast',
  'studio-releases': '#catalog',
  'studio-archive': '#catalog',
  'studio-fans': '#audience',
  'studio-newsletter': '#audience',
}

function normaliseHash(raw: string): string {
  const key = raw.replace(/^#/, '')
  if (!key) return ''
  const mapped = HASH_ALIASES[key]
  return mapped !== undefined ? mapped : raw
}

type Props = {
  isBoard?: boolean
}

/** PLAT-020 / v8: dashboard sidebar — v8 navigation items. */
export function StudioSidebar({ isBoard }: Props) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'
  const normHash = normaliseHash(hash)

  return (
    <aside className="db-sidebar">
      <nav aria-label="Dashboard sections">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isBoard).map(
          ({ href, label, Icon, isRoute, hash: itemHash }) => {
            let active: boolean
            if (isRoute) {
              if (href === '/dashboard') {
                active = onDashboard && (normHash === '' || normHash === undefined)
              } else {
                active = pathname === href || pathname.startsWith(`${href}/`)
              }
            } else {
              active =
                onDashboard &&
                itemHash !== undefined &&
                normaliseHash(hash) === normaliseHash(itemHash)
            }
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                className={`db-nav-item${active ? ' active' : ''}`}
              >
                <Icon />
                {label}
              </Link>
            )
          },
        )}
      </nav>
    </aside>
  )
}
