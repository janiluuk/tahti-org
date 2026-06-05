// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type AlertVariant = 'error' | 'success' | 'info' | 'warning'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

export function Alert({ variant = 'info', className, role = 'alert', ...props }: AlertProps) {
  return (
    <div role={role} className={cn('ui-alert', `ui-alert--${variant}`, className)} {...props} />
  )
}
