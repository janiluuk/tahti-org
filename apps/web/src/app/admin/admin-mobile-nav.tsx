// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MobileNavSheet } from '@tahti/ui'
import { useEffect, useRef, useState } from 'react'
import { ADMIN_MENU_GROUPS, ADMIN_NAV } from './admin-nav'

// Keep the same four group destinations as the desktop sidebar. The bottom bar
// exposes the group roots; the grouped More sheet exposes each group's tools.
const PRIMARY_HREFS = new Set<string>(ADMIN_MENU_GROUPS.map((group) => group.href))

function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

export function AdminMobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const primary = ADMIN_MENU_GROUPS.map((group) =>
    ADMIN_NAV.find((item) => item.href === group.href),
  ).filter((item): item is (typeof ADMIN_NAV)[number] => Boolean(item))
  const moreGroups = ADMIN_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .map((href) => ADMIN_NAV.find((item) => item.href === href))
      .filter(
        (item): item is (typeof ADMIN_NAV)[number] =>
          item !== undefined && !PRIMARY_HREFS.has(item.href),
      ),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      <MobileNavSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        triggerRef={moreButtonRef}
        ariaLabel="More admin sections"
      >
        {moreGroups.map((group) => (
          <section key={group.href} className="db-mobile-more-sheet__group">
            <h2 className="db-mobile-more-sheet__group-label">{group.label}</h2>
            <div className="db-mobile-more-sheet__grid">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="db-mobile-more-sheet__item"
                  onClick={() => setMoreOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </MobileNavSheet>
      <nav className="db-mobile-nav" aria-label="Admin mobile navigation">
        {primary.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link key={href} href={href} className={`db-mobile-nav-item${active ? ' active' : ''}`}>
              {icon}
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          ref={moreButtonRef}
          className={`db-mobile-nav-item db-mobile-nav-item--button${moreOpen ? ' active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <IconMore />
          <span>More</span>
        </button>
      </nav>
    </>
  )
}
