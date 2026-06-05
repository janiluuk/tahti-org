// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SelectHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return <select className={cn('ui-select', className)} {...props} />
}
