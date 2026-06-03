// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type BadgeVariant = 'live' | 'neutral' | 'success'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return <span className={cn('ui-badge', `ui-badge--${variant}`, className)} {...props} />
}
