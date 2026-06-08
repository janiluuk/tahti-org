// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type PublicPageHeaderProps = {
  title: string
  /** Muted intro copy and inline links below the title. */
  children?: ReactNode
  back?: { href: string; label: string }
  className?: string
}

/** Title block for light public pages (transparency, venues, governance, help). */
export function PublicPageHeader({ title, children, back, className }: PublicPageHeaderProps) {
  return (
    <header className={cn('brand-page-header', className)}>
      {back ? (
        <p className="brand-page-header__back">
          <a href={back.href}>{back.label}</a>
        </p>
      ) : null}
      <h1 className="brand-page-header__title">{title}</h1>
      {children ? <div className="brand-page-header__lead">{children}</div> : null}
    </header>
  )
}
