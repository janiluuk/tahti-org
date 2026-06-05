// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type HeadingLevel = 1 | 2 | 3 | 4

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
}

const TAG: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
}

export function Heading({ level = 2, className, ...props }: HeadingProps) {
  const Tag = TAG[level]
  return <Tag className={cn('ui-heading', `ui-heading--${level}`, className)} {...props} />
}
