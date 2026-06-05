'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const ROUTE_ITEMS = [
  { href: '/dashboard', label: 'Channel', icon: '▶', match: '/dashboard' },
  { href: '/dashboard/stats', label: 'Stats', icon: '📈', match: '/dashboard/stats' },
  { href: '/dashboard/editor', label: 'Editor', icon: '🎚', match: '/dashboard/editor' },
  { href: '/dashboard/stash', label: 'Stash', icon: '🔒', match: '/dashboard/stash' },
] as const

const HASH_ITEMS = [
  { href: '/dashboard#studio-archive', label: 'Archive', icon: '📁', hash: '#studio-archive' },
  { href: '/dashboard#studio-fans', label: 'Revenue', icon: '💰', hash: '#studio-fans' },
  {
    href: '/dashboard#studio-newsletter',
    label: 'Newsletter',
    icon: '📧',
    hash: '#studio-newsletter',
  },
  {
    href: '/dashboard#studio-releases',
    label: 'Smart Links',
    icon: '🔗',
    hash: '#studio-releases',
  },
  {
    href: '/dashboard#studio-distribution',
    label: 'Distribution',
    icon: '📡',
    hash: '#studio-distribution',
  },
  { href: '/dashboard#studio-settings', label: 'Settings', icon: '⚙', hash: '#studio-settings' },
] as const

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
        {ROUTE_ITEMS.map(({ href, label, icon, match }) => {
          const active =
            match === '/dashboard'
              ? onDashboard && (hash === '' || hash === '#studio-overview')
              : pathname === match || pathname.startsWith(`${match}/`)
          return (
            <Link key={href} href={href} className={`db-nav-item${active ? ' active' : ''}`}>
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          )
        })}
        {onDashboard &&
          HASH_ITEMS.map(({ href, label, icon, hash: itemHash }) => {
            const active = hash === itemHash
            return (
              <Link key={href} href={href} className={`db-nav-item${active ? ' active' : ''}`}>
                <span aria-hidden>{icon}</span>
                {label}
              </Link>
            )
          })}
      </nav>
    </aside>
  )
}
