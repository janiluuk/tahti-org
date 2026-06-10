// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import { SidebarNav, SidebarNavItem, type SidebarNavIcon } from './SidebarNav'

export interface DashboardNavItem {
  href: string
  icon: SidebarNavIcon
  label: string
  active?: boolean
  hidden?: boolean
}

export interface DashboardShellProps {
  displayName?: string
  isLive?: boolean
  navItems: DashboardNavItem[]
  /** Override default top bar (TAHTI wordmark + user chip). */
  topBar?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Artist dashboard layout — sidebar nav + main content column. */
export function DashboardShell({
  displayName,
  isLive,
  navItems,
  topBar,
  children,
  className,
}: DashboardShellProps) {
  const initial = displayName?.trim().charAt(0).toUpperCase()

  return (
    <div className={cn('dashboard-shell', className)}>
      {topBar ?? (
        <header className="dashboard-shell__top">
          <span className="dashboard-shell__logo">TAHTI</span>
          {displayName ? (
            <div className="dashboard-shell__user" aria-label={`Signed in as ${displayName}`}>
              {isLive ? <span className="dashboard-shell__live-dot" aria-hidden /> : null}
              <span className="dashboard-shell__avatar" aria-hidden>
                {initial}
              </span>
              <span>{displayName}</span>
            </div>
          ) : null}
        </header>
      )}
      <div className="dashboard-shell__layout">
        <SidebarNav label="Dashboard sections">
          {navItems
            .filter((item) => !item.hidden)
            .map((item) => (
              <SidebarNavItem
                key={`${item.href}-${item.label}`}
                href={item.href}
                icon={item.icon}
                active={item.active}
              >
                {item.label}
              </SidebarNavItem>
            ))}
        </SidebarNav>
        <main className="dashboard-shell__main">{children}</main>
      </div>
    </div>
  )
}
