// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SidebarNavIcon } from './SidebarNav'

export type DashboardTabId = 'overview' | 'broadcast' | 'catalog' | 'audience' | 'account'

export type DashboardNavDefinition = {
  href: string
  label: string
  icon: SidebarNavIcon
  isRoute?: boolean
  /** Hash fragment for in-dashboard tab links, e.g. `#overview`. */
  hash?: string
  /** StudioTabs panel id — derived from hash when omitted. */
  tabId?: DashboardTabId
  adminOnly?: boolean
}

export const DASHBOARD_NAV: DashboardNavDefinition[] = [
  {
    href: '/dashboard#overview',
    label: 'Channel',
    icon: 'channel',
    hash: '#overview',
    tabId: 'overview',
  },
  { href: '/dashboard/stats', label: 'Stats', icon: 'stats', isRoute: true },
  {
    href: '/dashboard#catalog',
    label: 'Archive',
    icon: 'archive',
    hash: '#catalog',
    tabId: 'catalog',
  },
  { href: '/dashboard/upload', label: 'Upload', icon: 'upload', isRoute: true },
  { href: '/dashboard/collections', label: 'Collections', icon: 'collections', isRoute: true },
  { href: '/dashboard/revenue', label: 'Revenue', icon: 'revenue', isRoute: true },
  {
    href: '/dashboard#audience',
    label: 'Newsletter',
    icon: 'newsletter',
    hash: '#audience',
    tabId: 'audience',
  },
  {
    href: '/dashboard#catalog',
    label: 'Smart Links',
    icon: 'links',
    hash: '#catalog',
    tabId: 'catalog',
  },
  {
    href: '/dashboard#broadcast',
    label: 'Distribution',
    icon: 'distribution',
    hash: '#broadcast',
    tabId: 'broadcast',
  },
  {
    href: '/dashboard#account',
    label: 'Settings',
    icon: 'settings',
    hash: '#account',
    tabId: 'account',
  },
  { href: '/dashboard/stash', label: 'Stash', icon: 'stash', isRoute: true },
  { href: '/admin', label: 'Admin', icon: 'admin', isRoute: true, adminOnly: true },
]

/** Map URL hash keys (without #) to StudioTabs panel ids. */
export const DASHBOARD_HASH_ALIASES: Record<string, DashboardTabId> = {
  overview: 'overview',
  'studio-overview': 'overview',
  'studio-stats': 'overview',
  membership: 'account',
  settings: 'account',
  'studio-settings': 'broadcast',
  'studio-distribution': 'broadcast',
  'studio-releases': 'catalog',
  'studio-archive': 'catalog',
  'studio-fans': 'audience',
  'studio-newsletter': 'audience',
  broadcast: 'broadcast',
  catalog: 'catalog',
  audience: 'audience',
  account: 'account',
}

export function resolveDashboardTabFromHash(
  raw: string,
  defaultTab: DashboardTabId = 'overview',
): DashboardTabId {
  const key = raw.replace(/^#/, '').trim()
  if (!key) return defaultTab
  const mapped = DASHBOARD_HASH_ALIASES[key]
  if (mapped) return mapped
  if (
    key === 'overview' ||
    key === 'broadcast' ||
    key === 'catalog' ||
    key === 'audience' ||
    key === 'account'
  ) {
    return key
  }
  return defaultTab
}

/** Normalise hash for sidebar active-state comparison (tab id, no #). */
export function normaliseDashboardHash(raw: string): string {
  return resolveDashboardTabFromHash(raw)
}

export function dashboardTabFromNavItem(
  item: Pick<DashboardNavDefinition, 'hash' | 'tabId'>,
): string {
  if (item.tabId) return item.tabId
  if (item.hash) return resolveDashboardTabFromHash(item.hash)
  return ''
}

/** Apply hash on the current dashboard page so StudioTabs receives hashchange. */
export function navigateDashboardHash(hash: string): void {
  const next = hash.startsWith('#') ? hash : `#${hash}`
  if (typeof window === 'undefined') return
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = next.slice(1)
}
