'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'

type NavItem = { href: string; label: string }

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Profile',
    items: [
      { href: '/dashboard/settings/account', label: 'Account' },
      { href: '/dashboard/settings/artist-info', label: 'Artist info' },
      { href: '/dashboard/settings/artist-info#members', label: 'Members' },
      { href: '/dashboard/settings/connections', label: 'Connections' },
      { href: '/dashboard/settings/discovery', label: 'Discovery' },
      { href: '/dashboard/settings/domain', label: 'Username & domain' },
      { href: '/dashboard/settings/api', label: 'API tokens' },
    ],
  },
  {
    label: 'Broadcast',
    items: [
      { href: '/dashboard/settings/distribution', label: 'Radio & announcements' },
      { href: '/dashboard/settings/green-room', label: 'Green room' },
      { href: '/dashboard/settings/moderators', label: 'Moderators' },
      { href: '/dashboard/settings/multistream', label: 'Multistream' },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/dashboard/settings/fan-subs', label: 'Fan subs' },
      { href: '/dashboard/settings/notifications', label: 'Notifications & visibility' },
    ],
  },
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
        {GROUPS.map((group) => (
          <Fragment key={group.label}>
            <span className="settings-subnav__group">{group.label}</span>
            {group.items.map((item) => {
              const itemPath = item.href.split('#')[0]!
              const active = pathname === itemPath || pathname?.startsWith(`${itemPath}/`)
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
          </Fragment>
        ))}
      </nav>
    </div>
  )
}
