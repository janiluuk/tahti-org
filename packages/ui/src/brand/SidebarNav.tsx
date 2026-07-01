// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export type SidebarNavIcon =
  | 'channel'
  | 'stats'
  | 'archive'
  | 'upload'
  | 'collections'
  | 'revenue'
  | 'newsletter'
  | 'links'
  | 'distribution'
  | 'settings'
  | 'stash'
  | 'admin'
  | 'appearance'
  | 'schedule'
  | 'venues'

export function SidebarNavIconSvg({ name }: { name: SidebarNavIcon }) {
  switch (name) {
    case 'channel':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 11 Q8 5 14 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4 13 Q8 8 12 13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="4" r="1.25" fill="currentColor" />
        </svg>
      )
    case 'stats':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2" y="9" width="3" height="5" rx="0.75" fill="currentColor" opacity=".6" />
          <rect x="6.5" y="5" width="3" height="9" rx="0.75" fill="currentColor" opacity=".8" />
          <rect x="11" y="2" width="3" height="12" rx="0.75" fill="currentColor" />
        </svg>
      )
    case 'archive':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="5"
            width="12"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M2 7h12" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M1.5 3.5h5l1.5 1.5H14.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'revenue':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 5v6M6 6.5c0-.83.67-1.5 1.5-1.5h1c.83 0 1.5.67 1.5 1.5S9.33 8 8.5 8h-1C6.67 8 6 8.67 6 9.5S6.67 11 7.5 11h1c.83 0 1.5-.67 1.5-1.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'newsletter':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="3.5"
            width="12"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M2 6l6 4 6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'links':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l1.77-1.77a3.5 3.5 0 0 0-4.95-4.95l-.88.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0L2.78 8.27a3.5 3.5 0 0 0 4.95 4.95l.88-.88"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'distribution':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2L9.5 6.5H14L10.25 9.25L11.5 14L8 11.5L4.5 14L5.75 9.25L2 6.5H6.5L8 2Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )
    case 'settings':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 1.5v1.75M8 12.75V14.5M1.5 8h1.75M12.75 8H14.5M3.4 3.4l1.24 1.24M11.36 11.36l1.24 1.24M12.6 3.4l-1.24 1.24M4.64 11.36l-1.24 1.24"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'stash':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="2"
            y="6"
            width="12"
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M5 6V4.5a3 3 0 0 1 6 0V6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="10.5" r="1.25" fill="currentColor" />
        </svg>
      )
    case 'upload':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 11V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M5 6L8 3L11 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'collections':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="1.5"
            y="1.5"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="8.5"
            y="1.5"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="1.5"
            y="8.5"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="8.5"
            y="8.5"
            width="6"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )
    case 'appearance':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 1.5 9.2 5.8 13.5 7 9.2 8.2 8 12.5 6.8 8.2 2.5 7l4.3-1.2L8 1.5Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <circle cx="12.5" cy="3.5" r="1" fill="currentColor" />
        </svg>
      )
    case 'admin':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2L13.5 4.5V9c0 2.5-2.25 4.5-5.5 5-3.25-.5-5.5-2.5-5.5-5V4.5L8 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'schedule':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 4.5A2.5 2.5 0 0 1 4.5 2H10l3 3v6.5A2.5 2.5 0 0 1 10.5 14h-6A2.5 2.5 0 0 1 2 11.5v-7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'venues':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 14s4.5-4.2 4.5-7.5A4.5 4.5 0 0 0 3.5 6.5C3.5 9.8 8 14 8 14Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
  }
}

export interface SidebarNavProps {
  children: React.ReactNode
  /** Accessible nav label. */
  label?: string
  className?: string
}

export interface SidebarNavItemProps {
  href: string
  icon: SidebarNavIcon
  active?: boolean
  children: React.ReactNode
  className?: string
}

/** v8 dashboard sidebar shell — compose with SidebarNavItem rows. */
export function SidebarNav({ children, label = 'Dashboard', className }: SidebarNavProps) {
  return (
    <nav className={cn('sidebar-nav', className)} aria-label={label}>
      {children}
    </nav>
  )
}

export function SidebarNavItem({
  href,
  icon,
  active = false,
  children,
  className,
}: SidebarNavItemProps) {
  return (
    <a
      href={href}
      className={cn('sidebar-nav__item', active && 'sidebar-nav__item--active', className)}
    >
      <span className="sidebar-nav__icon">
        <SidebarNavIconSvg name={icon} />
      </span>
      {children}
    </a>
  )
}
