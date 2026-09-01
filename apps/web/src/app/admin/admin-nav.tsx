// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function GovernanceNavIcon({ mark }: { mark: string }) {
  return (
    <span aria-hidden className="db-nav-item__mark">
      {mark}
    </span>
  )
}

export const ADMIN_NAV = [
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
    href: '/admin/radio',
    label: 'Radio',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="1.75" fill="currentColor" />
        <path
          d="M8 2.5V1M8 15v-1.5M2.5 8H1M15 8h-1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/radio-submissions',
    label: 'Radio submissions',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 3.5h8v9H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path
          d="M6.5 7.5 8 9l2.5-3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/news',
    label: 'News',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M4.5 6h4M4.5 8.2h7M4.5 10.4h7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/tahti-selects',
    label: 'Tahti Selects',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect
          x="2"
          y="2.5"
          width="12"
          height="11"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M5 6h6M5 8.5h6M5 11h3.5"
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
    href: '/admin/missed-shows',
    label: 'Missed shows',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/top-lists',
    label: 'Top lists',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3 13V9M8 13V3M13 13V6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/announcements',
    label: 'Announcements',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2 6.5v3a1 1 0 0 0 1 1h1.8L9 13V3L4.8 5.5H3a1 1 0 0 0-1 1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 6c.8.5.8 3.5 0 4M13.3 4.5c1.6 1.3 1.6 5.7 0 7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/disco-widgets',
    label: 'Disco widgets',
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
    href: '/admin/themes',
    label: 'Themes',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 2.5v11M2.5 8h11"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/internet-radio',
    label: 'Internet radio',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M4.5 4.5a5 5 0 0 0 0 7M11.5 4.5a5 5 0 0 1 0 7M2.5 2.5a8 8 0 0 0 0 11M13.5 2.5a8 8 0 0 1 0 11"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/storage',
    label: 'Storage',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <ellipse cx="8" cy="4" rx="6" ry="2" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M2 4v4c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8v4c0 1.1 2.7 2 6 2s6-.9 6-2V8"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/files',
    label: 'Files',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M4 2.5h5.5L13 6v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M9.5 2.5V6H13" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/admin/content-reports',
    label: 'Reports',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 1.5 14.5 13.5H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M8 6.5V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
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
    href: '/dashboard/governance',
    label: 'Member governance',
    icon: <GovernanceNavIcon mark="M" />,
  },
  {
    href: '/admin/governance/report',
    label: 'Annual reports',
    icon: <GovernanceNavIcon mark="R" />,
  },
  {
    href: '/admin/governance/resolutions',
    label: 'Board resolutions',
    icon: <GovernanceNavIcon mark="D" />,
  },
  {
    href: '/admin/governance/audit',
    label: 'Governance audit',
    icon: <GovernanceNavIcon mark="A" />,
  },
  {
    href: '/governance/venues',
    label: 'Venue verification',
    icon: <GovernanceNavIcon mark="V" />,
  },
  {
    href: '/transparency',
    label: 'Transparency',
    icon: <GovernanceNavIcon mark="T" />,
  },
  {
    href: '/admin/feature-requests',
    label: 'Features',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 2a4 4 0 0 0-2 7.5V11h4V9.5A4 4 0 0 0 8 2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 13.5h3M7 12h2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/grants',
    label: 'Grants',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M8 2v12M5 5h4.5a2 2 0 0 1 0 4H5M5 9h5a2 2 0 0 1 0 4H5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/admin/agm',
    label: 'AGM',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M5 2v2M11 2v2M2 7h12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M5 10h3M5 12.5h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/admin/settings/vendors',
    label: 'Vendors',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M6 2h4l1 3H5L6 2z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 8v3M6.5 9.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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
  {
    href: '/admin/logs',
    label: 'System logs',
    icon: <GovernanceNavIcon mark="L" />,
  },
  {
    href: '/admin/workers',
    label: 'Workers',
    icon: <GovernanceNavIcon mark="W" />,
  },
] as const

export const ADMIN_MENU_GROUPS = [
  {
    href: '/admin/dashboard',
    label: 'Overview',
    items: [
      '/admin/dashboard',
      '/admin/financial',
      '/admin/governance',
      '/dashboard/governance',
      '/admin/governance/report',
      '/admin/governance/resolutions',
      '/admin/governance/audit',
      '/governance/venues',
      '/transparency',
      '/admin/grants',
      '/admin/agm',
      '/admin/status',
    ],
  },
  {
    href: '/admin/users',
    label: 'Community',
    items: [
      '/admin/users',
      '/admin/support',
      '/admin/beta',
      '/admin/content-reports',
      '/admin/feature-requests',
    ],
  },
  {
    href: '/admin/radio',
    label: 'Content',
    items: [
      '/admin/radio',
      '/admin/radio-submissions',
      '/admin/tahti-selects',
      '/admin/news',
      '/admin/top-lists',
      '/admin/announcements',
      '/admin/disco-widgets',
    ],
  },
  {
    href: '/admin/streams',
    label: 'Manage',
    items: [
      '/admin/streams',
      '/admin/missed-shows',
      '/admin/internet-radio',
      '/admin/storage',
      '/admin/files',
      '/admin/themes',
      '/admin/settings/vendors',
      '/admin/logs',
      '/admin/workers',
    ],
  },
] as const

function menuItem(href: string) {
  return ADMIN_NAV.find((item) => item.href === href)
}

export function AdminNav() {
  const pathname = usePathname()
  const activeGroup =
    ADMIN_MENU_GROUPS.find((group) =>
      group.items.some((href) => pathname === href || pathname.startsWith(`${href}/`)),
    ) ?? ADMIN_MENU_GROUPS[0]
  const submenu = activeGroup.items.map(menuItem).filter(Boolean)

  return (
    <nav aria-label="Admin sections">
      <div className="db-nav-primary">
        {ADMIN_MENU_GROUPS.map((group) => {
          const item = menuItem(group.href)
          if (!item) return null
          return (
            <Link
              key={group.href}
              href={group.href}
              className={`db-nav-item${group.href === activeGroup.href ? ' active' : ''}`}
            >
              {item.icon}
              {group.label}
            </Link>
          )
        })}
      </div>
      <div className="db-nav-submenu" aria-label={`${activeGroup.label} menu`}>
        {submenu.map((item) => {
          if (!item) return null
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`db-nav-item${active ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
