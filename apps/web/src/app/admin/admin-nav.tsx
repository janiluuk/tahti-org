// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: '/admin/beta',
    label: 'Beta',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 2L9.8 6.2L14.5 6.5L11 9.6L12 14L8 11.5L4 14L5 9.6L1.5 6.5L6.2 6.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M2.5 13.5c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/streams',
    label: 'Streams',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 11 Q8 5 14 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M4.5 13 Q8 9 11.5 13"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="8" cy="7" r="1.25" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/admin/support',
    label: 'Support',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 2C4.69 2 2 4.69 2 8v2.5a1.5 1.5 0 0 0 1.5 1.5H5V8c0-1.66 1.34-3 3-3s3 1.34 3 3v4h1.5A1.5 1.5 0 0 0 14 10.5V8c0-3.31-2.69-6-6-6z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/financial',
    label: 'Financial',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 5v6M6.5 6.5A1.5 1.5 0 0 1 8 5h0a1.5 1.5 0 0 1 1.5 1.5c0 .83-.67 1.5-1.5 1.5h0c-.83 0-1.5.67-1.5 1.5S7.17 11 8 11h0c.83 0 1.5-.67 1.5-1.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/governance',
    label: 'Governance',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 2L14 5v2H2V5L8 2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M4 7v5M8 7v5M12 7v5M2 12h12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/status',
    label: 'Status',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 5v3.5l2.5 1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin sections">
      {NAV.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link key={href} href={href} className={`db-nav-item${active ? ' active' : ''}`}>
            {icon}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
