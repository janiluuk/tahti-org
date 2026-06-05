// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export type PanelVariant = 'default' | 'warning' | 'success' | 'error'

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'div' | 'article'
  variant?: PanelVariant
  flushTop?: boolean
  title?: ReactNode
  description?: ReactNode
  headerTight?: boolean
}

export function Panel({
  as: Tag = 'section',
  variant = 'default',
  flushTop,
  title,
  description,
  headerTight,
  className,
  children,
  ...props
}: PanelProps) {
  const hasHeader = title != null || description != null

  return (
    <Tag
      className={cn(
        'ui-panel',
        variant !== 'default' && `ui-panel--${variant}`,
        flushTop && 'ui-panel--flush-top',
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className={cn('ui-panel__header', headerTight && 'ui-panel__header--tight')}>
          {title != null ? (
            typeof title === 'string' ? (
              <h2 className="ui-heading ui-heading--2">{title}</h2>
            ) : (
              title
            )
          ) : null}
          {description != null ? (
            typeof description === 'string' ? (
              <p className="ui-text ui-text--sm ui-text--muted" style={{ marginTop: '0.5rem' }}>
                {description}
              </p>
            ) : (
              description
            )
          ) : null}
        </header>
      ) : null}
      {children}
    </Tag>
  )
}
