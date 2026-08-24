// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cn } from '../lib/cn'

export type BreadcrumbItem = { label: string; href?: string }

export type BreadcrumbProps = {
  items: BreadcrumbItem[]
  className?: string
}

/** Wayfinding trail for pages that don't correspond to a top-nav item (About,
 * Terms, Privacy, …) — the top nav's Home/Discover/Radio/Venues highlight has
 * nothing to point at on these, so this fills that gap instead of forcing a
 * misleading nav highlight. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className={cn('brand-breadcrumb', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="brand-breadcrumb__item">
            {item.href && !isLast ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
            )}
            {!isLast && (
              <span className="brand-breadcrumb__sep" aria-hidden>
                /
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
