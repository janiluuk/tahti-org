'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { usePathname } from 'next/navigation'
import { useEffect, useState, type MouseEvent } from 'react'
import { DASHBOARD_NAV, isDashboardNavItemActive, navigateDashboardHash } from './dashboard-nav'
import { SidebarNavLink } from './SidebarNavLink'

type Props = {
  isBoard?: boolean
  hasChannel?: boolean
}

/** Production dashboard sidebar — v8 nav items via SidebarNavLink. */
export function StudioSidebar({ isBoard, hasChannel = true }: Props) {
  const pathname = usePathname()
  const [hash, setHash] = useState('')

  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [pathname])

  const onDashboard = pathname === '/dashboard' || pathname === '/dashboard/'

  function onHashNavClick(e: MouseEvent<HTMLAnchorElement>, itemHash: string | undefined) {
    if (!itemHash || !onDashboard) return
    e.preventDefault()
    navigateDashboardHash(itemHash)
  }

  return (
    <aside className="db-sidebar">
      <nav aria-label="Dashboard sections">
        {DASHBOARD_NAV.filter(
          (item) => (!item.adminOnly || isBoard) && (!item.requiresChannel || hasChannel),
        ).map(({ href, label, icon, isRoute, hash: itemHash, sectionKey }) => {
          let active: boolean
          if (isRoute) {
            active = pathname === href || pathname.startsWith(`${href}/`)
          } else {
            active = isDashboardNavItemActive(hash, { sectionKey, hash: itemHash }, onDashboard)
          }
          return (
            <SidebarNavLink
              key={`${href}-${label}`}
              href={href}
              icon={icon}
              active={active}
              surface="studio"
              onClick={itemHash ? (e) => onHashNavClick(e, itemHash) : undefined}
            >
              {label}
            </SidebarNavLink>
          )
        })}
      </nav>
    </aside>
  )
}
