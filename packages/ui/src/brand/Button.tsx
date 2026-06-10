// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export type BrandButtonVariant = 'primary' | 'secondary' | 'warn' | 'danger' | 'sm'

export interface BrandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandButtonVariant
  as?: 'button' | 'a'
  href?: string
  children: React.ReactNode
}

/** v8 brand button — primary is cyan; marketing site uses amber `Button` in `./marketing`. */
export function BrandButton({
  variant = 'primary',
  as: Tag = 'button',
  href,
  children,
  className,
  type = 'button',
  ...props
}: BrandButtonProps) {
  const cls = cn('brand-btn', `brand-btn--${variant}`, className)

  if (Tag === 'a') {
    return (
      <a href={href} className={cls} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} className={cls} {...props}>
      {children}
    </button>
  )
}
