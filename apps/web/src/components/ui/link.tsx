// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { AnchorHTMLAttributes } from 'react'
import { cn } from './cn'

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement>

export function Link({ className, ...props }: LinkProps) {
  return <a className={cn('ui-link', className)} {...props} />
}
