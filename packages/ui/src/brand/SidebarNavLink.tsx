'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '../lib/cn'
import { SidebarNavIconSvg, type SidebarNavIcon } from './SidebarNav'

export type SidebarNavSurface = 'default' | 'studio'

export interface SidebarNavLinkProps {
  href: string
  icon: SidebarNavIcon
  active?: boolean
  children: ReactNode
  surface?: SidebarNavSurface
  className?: string
}

/** Next.js sidebar row — studio surface maps to production `db-nav-item` styles. */
export function SidebarNavLink({
  href,
  icon,
  active = false,
  children,
  surface = 'default',
  className,
}: SidebarNavLinkProps) {
  if (surface === 'studio') {
    return (
      <Link href={href} className={cn('db-nav-item', active && 'active', className)}>
        <SidebarNavIconSvg name={icon} />
        {children}
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn('sidebar-nav__item', active && 'sidebar-nav__item--active', className)}
    >
      <span className="sidebar-nav__icon">
        <SidebarNavIconSvg name={icon} />
      </span>
      {children}
    </Link>
  )
}
