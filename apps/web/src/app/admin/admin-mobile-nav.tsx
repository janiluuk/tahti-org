// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ADMIN_NAV } from './admin-nav'

// AdminShell's sidebar (.db-sidebar) is hidden outright at ≤768px (same rule
// that collapses the artist dashboard sidebar — see brand-studio.css's
// "Mobile bottom nav" block) but, unlike the dashboard, nothing replaced it
// here: board members on a phone had literally no way to reach any admin
// section besides the couple of links in the top bar. Mirrors
// StudioMobileNav's pattern (packages/ui/src/brand/StudioMobileNav.tsx) — a
// handful of primary sections in an always-visible bottom bar, everything
// else behind "More".
const PRIMARY_HREFS = ['/admin/dashboard', '/admin/users', '/admin/financial', '/admin/support']

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

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const primary = PRIMARY_HREFS.map((href) => ADMIN_NAV.find((item) => item.href === href)).filter(
    (item): item is (typeof ADMIN_NAV)[number] => Boolean(item),
  )
  const moreItems = ADMIN_NAV.filter((item) => !PRIMARY_HREFS.includes(item.href))

  return (
    <>
      {moreOpen && (
        <div
          className="db-mobile-more-overlay"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="db-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More admin sections"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="db-mobile-more-sheet__handle" aria-hidden />
            <div className="db-mobile-more-sheet__grid">
              {moreItems.map((item) => (
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
          </div>
        </div>
      )}
      <nav className="db-mobile-nav" aria-label="Admin mobile navigation">
        {primary.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`db-mobile-nav-item${active ? ' active' : ''}`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
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
