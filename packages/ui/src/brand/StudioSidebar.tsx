// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { href: '#studio-overview', label: 'Channel', icon: '▶' },
  { href: '#studio-stats', label: 'Stats', icon: '📈' },
  { href: '#studio-archive', label: 'Archive', icon: '📁' },
  { href: '#studio-fans', label: 'Revenue', icon: '💰' },
  { href: '#studio-newsletter', label: 'Newsletter', icon: '📧' },
  { href: '#studio-releases', label: 'Smart Links', icon: '🔗' },
  { href: '#studio-distribution', label: 'Distribution', icon: '📡' },
  { href: '#studio-settings', label: 'Settings', icon: '⚙' },
] as const

/** PLAT-020: dashboard sidebar — hash anchors on the long dashboard page. */
export function StudioSidebar() {
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return (
    <aside className="db-sidebar">
      <nav aria-label="Dashboard sections">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = hash === href || (hash === '' && href === '#studio-overview')
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
