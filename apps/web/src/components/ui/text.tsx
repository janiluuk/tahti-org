// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes } from 'react'
import { cn } from './cn'

export type TextTone = 'default' | 'muted' | 'secondary' | 'success' | 'error' | 'warning'
export type TextSize = 'xs' | 'sm' | 'base'

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div'
  tone?: TextTone
  size?: TextSize
}

export function Text({
  as: Tag = 'p',
  tone = 'default',
  size = 'base',
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        'ui-text',
        size !== 'base' && `ui-text--${size}`,
        tone !== 'default' && `ui-text--${tone}`,
        className,
      )}
      {...props}
    />
  )
}
