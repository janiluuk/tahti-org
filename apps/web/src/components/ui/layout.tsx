// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type StackGap = 2 | 3 | 4 | 6

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: StackGap
}

export function Stack({ gap = 4, className, ...props }: StackProps) {
  return <div className={cn('ui-stack', `ui-stack--gap-${gap}`, className)} {...props} />
}

export interface RowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: StackGap
  between?: boolean
}

export function Row({ gap = 2, between, className, ...props }: RowProps) {
  return (
    <div
      className={cn('ui-row', `ui-row--gap-${gap}`, between && 'ui-row--between', className)}
      {...props}
    />
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('ui-divider', className)} />
}

export type PageSize = 'sm' | 'md' | 'lg'

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  size?: PageSize
}

export function PageShell({ size = 'md', className, ...props }: PageShellProps) {
  return <div className={cn('ui-page', `ui-page--${size}`, className)} {...props} />
}

export interface CodeProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
}

export function Code({ className, ...props }: CodeProps) {
  return <code className={cn('ui-code', className)} {...props} />
}
