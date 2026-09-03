'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DASHBOARD_NAV, DASHBOARD_PRIMARY_NAV } from './dashboard-nav'
import type { DashboardNavDefinition } from './dashboard-nav'
import { MobileNavSheet } from './MobileNavSheet'
import { SidebarNavIconSvg } from './SidebarNav'

const LISTENER_MOBILE_NAV: DashboardNavDefinition[] = [
  { href: '/feed', label: 'Feed', icon: 'sound', isRoute: true },
  { href: '/dashboard/messages', label: 'Messages', icon: 'newsletter', isRoute: true },
  { href: '/dashboard/settings/account', label: 'Account', icon: 'settings', isRoute: true },
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

const PRIMARY_HREFS = new Set(DASHBOARD_PRIMARY_NAV.map((item) => item.href))

/** Mobile bottom nav for the dashboard (hidden on desktop). The bar itself only
 * has room for a handful of items — the same primary destinations as the
 * desktop sidebar stay visible, while the rest of DASHBOARD_NAV surfaces
 * behind "More". */
export function StudioMobileNav({
  hasChannel = true,
  isBoard = false,
}: {
  hasChannel?: boolean
  isBoard?: boolean
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const moreItems = hasChannel
    ? DASHBOARD_NAV.filter((item) => {
        if (item.adminOnly && !isBoard) return false
        if (item.requiresChannel && !hasChannel) return false
        if (PRIMARY_HREFS.has(item.href)) return false
        // Mobile's "Settings" points at /settings/account; skip the sidebar's plain /settings row too.
        if (item.href === '/dashboard/settings') return false
        return true
      })
    : []

  const moreGroups = moreItems.reduce<Array<{ label: string; items: DashboardNavDefinition[] }>>(
    (groups, item) => {
      const label = item.group ?? 'More'
      const group = groups.find((candidate) => candidate.label === label)
      if (group) group.items.push(item)
      else groups.push({ label, items: [item] })
      return groups
    },
    [],
  )

  const primaryNav = hasChannel ? DASHBOARD_PRIMARY_NAV : LISTENER_MOBILE_NAV

  return (
    <>
      <MobileNavSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        triggerRef={moreButtonRef}
        ariaLabel="More dashboard sections"
      >
        {moreGroups.map((group) => (
          <section key={group.label} className="db-mobile-more-sheet__group">
            <h2 className="db-mobile-more-sheet__group-label">{group.label}</h2>
            <div className="db-mobile-more-sheet__grid">
              {group.items.map((item) => (
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
          </section>
        ))}
      </MobileNavSheet>
      <nav className="db-mobile-nav" aria-label="Mobile navigation">
        {primaryNav.map(({ href, label, icon }) => {
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
              <SidebarNavIconSvg name={icon} />
              <span>{label}</span>
            </Link>
          )
        })}
        {moreItems.length > 0 && (
          <button
            type="button"
            ref={moreButtonRef}
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
