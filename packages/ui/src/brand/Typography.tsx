// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type BrandTextSize =
  | 'display'
  | 'statBig'
  | 'h2'
  | 'h3'
  | 'body'
  | 'sm'
  | 'xs'
  | 'label'
  | 'micro'

export type BrandTextTone = 'primary' | 'secondary' | 'tertiary' | 'onBrand'

export interface BrandTextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div'
  size?: BrandTextSize
  tone?: BrandTextTone
}

/** Body copy and inline text on brand (dark) surfaces. */
export function BrandText({
  as: Tag = 'p',
  size = 'body',
  tone = 'primary',
  className,
  ...props
}: BrandTextProps) {
  return (
    <Tag
      className={cn('type', `type--${size}`, tone !== 'primary' && `type--tone-${tone}`, className)}
      {...props}
    />
  )
}

export type BrandHeadingLevel = 1 | 2 | 3

const HEADING_SIZE: Record<BrandHeadingLevel, BrandTextSize> = {
  1: 'display',
  2: 'h2',
  3: 'h3',
}

export interface BrandHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: BrandHeadingLevel
  tone?: BrandTextTone
}

/** Page and section headings on brand surfaces. */
export function BrandHeading({
  level = 2,
  tone = 'primary',
  className,
  ...props
}: BrandHeadingProps) {
  const Tag = ({ 1: 'h1', 2: 'h2', 3: 'h3' } as const)[level]
  return (
    <Tag
      className={cn(
        'type',
        'type--heading',
        `type--${HEADING_SIZE[level]}`,
        tone !== 'primary' && `type--tone-${tone}`,
        className,
      )}
      {...props}
    />
  )
}

export interface BrandSectionLabelProps extends HTMLAttributes<HTMLSpanElement> {
  as?: 'span' | 'p' | 'div' | 'h2'
}

/** Uppercase section label (v8 mockup metadata style). */
export function BrandSectionLabel({
  as: Tag = 'span',
  className,
  ...props
}: BrandSectionLabelProps) {
  return <Tag className={cn('type', 'type--label', 'type--section-label', className)} {...props} />
}
