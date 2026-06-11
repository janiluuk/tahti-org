// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SidebarNavIcon } from './SidebarNav'

export type DashboardNavDefinition = {
  href: string
  label: string
  icon: SidebarNavIcon
  isRoute?: boolean
  hash?: string
  adminOnly?: boolean
}

export const DASHBOARD_NAV: DashboardNavDefinition[] = [
  { href: '/dashboard', label: 'Channel', icon: 'channel', isRoute: true },
  { href: '/dashboard/stats', label: 'Stats', icon: 'stats', isRoute: true },
  { href: '/dashboard#catalog', label: 'Archive', icon: 'archive', hash: '#catalog' },
  { href: '/dashboard/revenue', label: 'Revenue', icon: 'revenue', isRoute: true },
  { href: '/dashboard#audience', label: 'Newsletter', icon: 'newsletter', hash: '#audience' },
  { href: '/dashboard#catalog', label: 'Smart Links', icon: 'links', hash: '#catalog' },
  {
    href: '/dashboard#broadcast',
    label: 'Distribution',
    icon: 'distribution',
    hash: '#broadcast',
  },
  { href: '/dashboard#account', label: 'Settings', icon: 'settings', hash: '#account' },
  { href: '/dashboard/stash', label: 'Stash', icon: 'stash', isRoute: true },
  { href: '/admin', label: 'Admin', icon: 'admin', isRoute: true, adminOnly: true },
]

export const DASHBOARD_HASH_ALIASES: Record<string, string> = {
  'studio-overview': '',
  'studio-stats': '',
  'studio-settings': '#broadcast',
  'studio-distribution': '#broadcast',
  'studio-releases': '#catalog',
  'studio-archive': '#catalog',
  'studio-fans': '#audience',
  'studio-newsletter': '#audience',
}

export function normaliseDashboardHash(raw: string): string {
  const key = raw.replace(/^#/, '')
  if (!key) return ''
  const mapped = DASHBOARD_HASH_ALIASES[key]
  return mapped !== undefined ? mapped : raw
}
