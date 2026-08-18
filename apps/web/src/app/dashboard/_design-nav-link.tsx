'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarNavIconSvg } from '@tahti/ui'

/** The "Design" quick-link in the page-header actions bar (rendered on every
 * dashboard subpage, including the channel designer itself) — marks itself
 * current when you're already on /dashboard/channel/edit, matching how the
 * main sidebar highlights its own active section. */
export function DesignNavLink() {
  const pathname = usePathname()
  const active = pathname === '/dashboard/channel/edit' || pathname?.startsWith('/dashboard/channel/edit/')

  return (
    <NextLink
      href="/dashboard/channel/edit"
      className={`ui-btn ui-btn--sm ui-btn--ghost${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <SidebarNavIconSvg name="appearance" />
      Design
    </NextLink>
  )
}
