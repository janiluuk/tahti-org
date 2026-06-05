// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: ReactNode
}

export function Label({ hint, className, children, ...props }: LabelProps) {
  return (
    <label className={cn('ui-field', className)} {...props}>
      <span className="ui-label">{children}</span>
      {hint ? <span className="ui-hint">{hint}</span> : null}
    </label>
  )
}

export interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

/** Label + control wrapper (pass `htmlFor` when the control has an `id`). */
export function Field({ label, hint, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn('ui-field', className)}>
      <label className="ui-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <span className="ui-hint">{hint}</span> : null}
    </div>
  )
}
