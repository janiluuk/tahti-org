// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SidebarNavIcon } from './SidebarNav'

export type DashboardTabId = 'overview' | 'broadcast' | 'audience'

export type DashboardSectionKey =
  | 'overview'
  | 'archive'
  | 'releases'
  | 'collections'
  | 'newsletter'
  | 'broadcast'
  | 'account'

export type DashboardNavDefinition = {
  href: string
  label: string
  icon: SidebarNavIcon
  isRoute?: boolean
  /** Hash fragment for in-dashboard links, e.g. `#archive`. */
  hash?: string
  /** Section key for active-state — unique per nav row. */
  sectionKey?: DashboardSectionKey
  /** Hide when the user has no channel (archive, broadcast, etc.). */
  requiresChannel?: boolean
  adminOnly?: boolean
}

export const DASHBOARD_SECTION_TO_TAB: Record<DashboardSectionKey, DashboardTabId> = {
  overview: 'overview',
  // Archive, releases, and collections all moved to dedicated routes — old in-page anchors fall back to overview.
  archive: 'overview',
  releases: 'overview',
  collections: 'overview',
  newsletter: 'audience',
  broadcast: 'broadcast',
  // Account settings moved to /dashboard/settings/account — old in-page anchor falls back to overview.
  account: 'overview',
}

/** Map URL hash keys (without #) to a unique dashboard section for nav highlighting. */
export const DASHBOARD_HASH_TO_SECTION: Record<string, DashboardSectionKey> = {
  overview: 'overview',
  'studio-overview': 'overview',
  'studio-stats': 'overview',
  catalog: 'archive',
  archive: 'archive',
  'studio-archive': 'archive',
  releases: 'releases',
  collections: 'collections',
  'smart-links': 'releases',
  'studio-releases': 'releases',
  'studio-collections': 'collections',
  audience: 'newsletter',
  newsletter: 'newsletter',
  'studio-fans': 'newsletter',
  'studio-newsletter': 'newsletter',
  broadcast: 'broadcast',
  distribution: 'broadcast',
  'studio-settings': 'broadcast',
  'studio-distribution': 'broadcast',
  account: 'account',
  membership: 'account',
  settings: 'account',
}

/** @deprecated Use DASHBOARD_HASH_TO_SECTION — kept for StudioTabs hashAliases compat. */
export const DASHBOARD_HASH_ALIASES: Record<string, DashboardTabId> = Object.fromEntries(
  Object.entries(DASHBOARD_HASH_TO_SECTION).map(([hash, section]) => [
    hash,
    DASHBOARD_SECTION_TO_TAB[section],
  ]),
) as Record<string, DashboardTabId>

export function resolveDashboardSectionKey(
  raw: string,
  defaultSection: DashboardSectionKey = 'overview',
): DashboardSectionKey {
  const key = raw.replace(/^#/, '').trim()
  if (!key) return defaultSection
  return DASHBOARD_HASH_TO_SECTION[key] ?? defaultSection
}

export function resolveDashboardTabFromHash(
  raw: string,
  defaultTab: DashboardTabId = 'overview',
): DashboardTabId {
  const section = resolveDashboardSectionKey(raw)
  return DASHBOARD_SECTION_TO_TAB[section] ?? defaultTab
}

/** Normalise hash for sidebar active-state comparison (section key). */
export function normaliseDashboardHash(raw: string): string {
  return resolveDashboardSectionKey(raw)
}

export function isDashboardNavItemActive(
  currentHash: string,
  item: Pick<DashboardNavDefinition, 'sectionKey' | 'hash' | 'isRoute'>,
  onDashboard: boolean,
): boolean {
  if (!onDashboard || !item.sectionKey) return false
  return resolveDashboardSectionKey(currentHash) === item.sectionKey
}

export const DASHBOARD_NAV: DashboardNavDefinition[] = [
  {
    href: '/dashboard',
    label: 'Channel',
    icon: 'channel',
    isRoute: true,
  },
  {
    href: '/dashboard/channel/edit',
    label: 'Design',
    icon: 'appearance',
    isRoute: true,
    requiresChannel: true,
  },
  { href: '/dashboard/stats', label: 'Stats', icon: 'stats', isRoute: true },
  {
    href: '/dashboard/archive',
    label: 'Archive',
    icon: 'archive',
    isRoute: true,
    requiresChannel: true,
  },
  { href: '/dashboard/upload', label: 'Upload', icon: 'upload', isRoute: true },
  {
    href: '/dashboard/schedule',
    label: 'Schedule',
    icon: 'schedule',
    isRoute: true,
    requiresChannel: true,
  },
  { href: '/dashboard/venues', label: 'Venues', icon: 'venues', isRoute: true },
  { href: '/dashboard/collections', label: 'Collections', icon: 'collections', isRoute: true },
  { href: '/dashboard/revenue', label: 'Revenue', icon: 'revenue', isRoute: true },
  {
    href: '/dashboard/newsletter/compose',
    label: 'Newsletter',
    icon: 'newsletter',
    isRoute: true,
    requiresChannel: true,
  },
  {
    href: '/dashboard/releases',
    label: 'Smart Links',
    icon: 'links',
    isRoute: true,
    requiresChannel: true,
  },
  {
    href: '/dashboard/broadcast',
    label: 'Broadcast',
    icon: 'distribution',
    isRoute: true,
    sectionKey: 'broadcast',
    requiresChannel: true,
  },
  { href: '/dashboard/stash', label: 'Stash', icon: 'stash', isRoute: true },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings', isRoute: true },
  { href: '/admin', label: 'Admin', icon: 'admin', isRoute: true, adminOnly: true },
]

/** Scroll to a dashboard section anchor after tab content mounts. */
export function scrollToDashboardSection(raw: string): void {
  if (typeof window === 'undefined') return
  const section = resolveDashboardSectionKey(raw)
  const tab = DASHBOARD_SECTION_TO_TAB[section]
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const target =
        document.getElementById(section) ?? document.getElementById(`studio-tabpanel-${tab}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

/** Apply hash on the current dashboard page so StudioTabs receives hashchange. */
export function navigateDashboardHash(hash: string): void {
  const next = hash.startsWith('#') ? hash : `#${hash}`
  if (typeof window === 'undefined') return
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    scrollToDashboardSection(next)
    return
  }
  window.location.hash = next.slice(1)
}
