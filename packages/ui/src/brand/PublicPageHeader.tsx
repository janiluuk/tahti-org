// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

export type PublicPageHeaderProps = {
  title: string
  /** Muted intro copy and inline links below the title. */
  children?: ReactNode
  /** Single link back to a clear parent page (e.g. "← Governance"). */
  back?: { href: string; label: string }
  /** Wayfinding trail shown above the title — for pages with no single
   * obvious parent to link back to and no matching top-nav item to
   * highlight (About, Terms, Privacy, …). Last item is the current page and
   * renders as plain text, not a link. Takes precedence over `back` if both
   * are given. */
  breadcrumb?: BreadcrumbItem[]
  className?: string
}

/** Title block for light public pages (transparency, venues, governance, help). */
export function PublicPageHeader({
  title,
  children,
  back,
  breadcrumb,
  className,
}: PublicPageHeaderProps) {
  return (
    <header className={cn('brand-page-header', className)}>
      {breadcrumb ? (
        <Breadcrumb items={breadcrumb} className="brand-page-header__breadcrumb" />
      ) : back ? (
        <p className="brand-page-header__back">
          <a href={back.href}>{back.label}</a>
        </p>
      ) : null}
      <h1 className="brand-page-header__title">{title}</h1>
      {children ? <div className="brand-page-header__lead">{children}</div> : null}
    </header>
  )
}
