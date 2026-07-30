'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard/settings/account', label: 'Account' },
  { href: '/dashboard/settings/artist-info', label: 'Artist info' },
  { href: '/dashboard/settings/media', label: 'Media & Presskit' },
  { href: '/dashboard/settings/discovery', label: 'Discovery' },
  { href: '/dashboard/settings/distribution', label: 'Radio & announcements' },
  { href: '/dashboard/settings/moderators', label: 'Moderators' },
  { href: '/dashboard/settings/notifications', label: 'Notification settings' },
  { href: '/dashboard/settings/domain', label: 'Username & domain' },
  { href: '/dashboard/settings/fan-subs', label: 'Fan subs' },
  { href: '/dashboard/settings/multistream', label: 'Multistream' },
]

/** Settings area sub-nav — each link is its own focused page, not a tab over shared state. */
export function SettingsSubnav() {
  const pathname = usePathname()

  return (
    <div className="settings-subnav-row">
      <Link href="/dashboard" className="settings-subnav__back">
        ← Dashboard
      </Link>
      <nav className="settings-subnav" aria-label="Settings sections">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`settings-subnav__item${active ? ' settings-subnav__item--active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
