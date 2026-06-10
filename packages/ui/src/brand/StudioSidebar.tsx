'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DASHBOARD_NAV, normaliseDashboardHash } from './dashboard-nav'
import { SidebarNavLink } from './SidebarNavLink'

type Props = {
  isBoard?: boolean
}

/** Production dashboard sidebar — v8 nav items via SidebarNavLink. */
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
  const normHash = normaliseDashboardHash(hash)

  return (
    <aside className="db-sidebar">
      <nav aria-label="Dashboard sections">
        {DASHBOARD_NAV.filter((item) => !item.adminOnly || isBoard).map(
          ({ href, label, icon, isRoute, hash: itemHash }) => {
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
                normaliseDashboardHash(hash) === normaliseDashboardHash(itemHash)
            }
            return (
              <SidebarNavLink
                key={`${href}-${label}`}
                href={href}
                icon={icon}
                active={active}
                surface="studio"
              >
                {label}
              </SidebarNavLink>
            )
          },
        )}
      </nav>
    </aside>
  )
}
