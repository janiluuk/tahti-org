'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
  DASHBOARD_NAV,
  DASHBOARD_PRIMARY_NAV,
  DASHBOARD_SUBMENUS,
  isDashboardNavItemActive,
  navigateDashboardHash,
} from './dashboard-nav'
import type { DashboardNavDefinition } from './dashboard-nav'
import { SidebarNavLink } from './SidebarNavLink'

type Props = {
  isBoard?: boolean
  hasChannel?: boolean
}

const LISTENER_NAV: DashboardNavDefinition[] = [
  { href: '/feed', label: 'Feed', icon: 'posts', isRoute: true },
  { href: '/dashboard/messages', label: 'Messages', icon: 'newsletter', isRoute: true },
  { href: '/dashboard/settings/account', label: 'Account', icon: 'settings', isRoute: true },
]

function isItemActive(
  pathname: string | null,
  hash: string,
  onDashboard: boolean,
  item: DashboardNavDefinition,
): boolean {
  if (item.isRoute) {
    // `/dashboard` is a path prefix of every other dashboard route, so it can only
    // ever match exactly — a startsWith check here would light up Channel everywhere.
    return item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === item.href || Boolean(pathname?.startsWith(`${item.href}/`))
  }
  return isDashboardNavItemActive(
    hash,
    { sectionKey: item.sectionKey, hash: item.hash, isRoute: item.isRoute },
    onDashboard,
  )
}

function NavRows({
  items,
  pathname,
  hash,
  onDashboard,
  onHashNavClick,
}: {
  items: DashboardNavDefinition[]
  pathname: string | null
  hash: string
  onDashboard: boolean
  onHashNavClick: (e: MouseEvent<HTMLAnchorElement>, itemHash: string | undefined) => void
}) {
  return (
    <>
      {items.map((item) => {
        const { href, label, icon, hash: itemHash, group } = item
        const active = isItemActive(pathname, hash, onDashboard, item)
        return (
          <Fragment key={`${href}-${label}`}>
            {group && <div className="db-nav-group-label">{group}</div>}
            <SidebarNavLink
              href={href}
              icon={icon}
              active={active}
              surface="studio"
              onClick={itemHash ? (e) => onHashNavClick(e, itemHash) : undefined}
            >
              {label}
            </SidebarNavLink>
          </Fragment>
        )
      })}
    </>
  )
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
  const navItems = hasChannel
    ? DASHBOARD_NAV.filter(
        (item) => (!item.adminOnly || isBoard) && (!item.requiresChannel || hasChannel),
      )
    : LISTENER_NAV

  const { primary, secondary } = useMemo(() => {
    const primaryItems: DashboardNavDefinition[] = []
    const secondaryItems: DashboardNavDefinition[] = []
    for (const item of navItems) {
      if (item.secondary) secondaryItems.push(item)
      else primaryItems.push(item)
    }
    return { primary: primaryItems, secondary: secondaryItems }
  }, [navItems])

  const secondaryOpen = secondary.some((item) => isItemActive(pathname, hash, onDashboard, item))

  const activePrimary =
    DASHBOARD_PRIMARY_NAV.find((item) => {
      if (item.href === '/dashboard') return pathname === '/dashboard'
      if (pathname?.startsWith(item.href)) return true
      return (DASHBOARD_SUBMENUS[item.href] ?? []).some((child) => pathname?.startsWith(child.href))
    }) ?? DASHBOARD_PRIMARY_NAV[0]
  const submenu = activePrimary ? (DASHBOARD_SUBMENUS[activePrimary.href] ?? []) : []

  function onHashNavClick(e: MouseEvent<HTMLAnchorElement>, itemHash: string | undefined) {
    if (!itemHash || !onDashboard) return
    e.preventDefault()
    navigateDashboardHash(itemHash)
  }

  return (
    <aside className="db-sidebar">
      <nav aria-label={hasChannel ? 'Dashboard sections' : 'Account'}>
        {hasChannel ? (
          <>
            <div className="db-nav-primary">
              {DASHBOARD_PRIMARY_NAV.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  active={item.href === activePrimary?.href}
                  surface="studio"
                >
                  {item.label}
                </SidebarNavLink>
              ))}
            </div>
            <div className="db-nav-submenu" aria-label={`${activePrimary?.label} menu`}>
              <NavRows
                items={submenu}
                pathname={pathname}
                hash={hash}
                onDashboard={onDashboard}
                onHashNavClick={onHashNavClick}
              />
            </div>
          </>
        ) : (
          <NavRows
            items={primary}
            pathname={pathname}
            hash={hash}
            onDashboard={onDashboard}
            onHashNavClick={onHashNavClick}
          />
        )}
        {hasChannel && secondary.length > 0 && (
          <details className="db-nav-more" {...(secondaryOpen ? { open: true } : {})}>
            <summary className="db-nav-more__summary">More</summary>
            <NavRows
              items={secondary}
              pathname={pathname}
              hash={hash}
              onDashboard={onDashboard}
              onHashNavClick={onHashNavClick}
            />
          </details>
        )}
      </nav>
    </aside>
  )
}
