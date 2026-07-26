// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export interface AdminShellProps {
  displayName: string
  sidebar: React.ReactNode
  children: React.ReactNode
  /** Override default admin strip + header. */
  header?: React.ReactNode
  /** `studio` uses production tahti-studio + admin-shell.css layout. */
  variant?: 'playground' | 'studio'
  className?: string
}

/** Board admin layout — amber view strip, sidebar slot, main content. */
export function AdminShell({
  displayName,
  sidebar,
  children,
  header,
  variant = 'playground',
  className,
}: AdminShellProps) {
  const initial = displayName.trim().charAt(0).toUpperCase()

  if (variant === 'studio') {
    return (
      <div data-tahti-ui="studio" className={cn('tahti-studio admin-shell', className)}>
        {header}
        <div className="db-layout shell-app">
          <aside className="db-sidebar">{sidebar}</aside>
          <main className="db-main shell-app__content admin-main">{children}</main>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('admin-shell-composite', className)}>
      {header ?? (
        <>
          <div className="admin-shell-composite__strip" role="status">
            ADMIN VIEW · {displayName}
          </div>
          <header className="admin-shell-composite__top">
            <span className="admin-shell-composite__logo">TAHTI ADMIN</span>
            <div className="admin-shell-composite__user">
              <span className="admin-shell-composite__avatar" aria-hidden>
                {initial}
              </span>
              <span>{displayName}</span>
            </div>
          </header>
        </>
      )}
      <div className="admin-shell-composite__layout">
        <aside className="admin-shell-composite__sidebar">{sidebar}</aside>
        <main className="admin-shell-composite__main">{children}</main>
      </div>
    </div>
  )
}
