// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export interface BrandInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean
}

/** Dark-theme text input (v8). */
export function BrandInput({ mono, className, ...props }: BrandInputProps) {
  return <input className={cn('brand-input', mono && 'brand-input--mono', className)} {...props} />
}

export interface BrandFieldProps {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}

export function BrandField({ label, htmlFor, children, className }: BrandFieldProps) {
  return (
    <div className={cn('brand-field', className)}>
      <label htmlFor={htmlFor} className="brand-field__label type type--label type--section-label">
        {label}
      </label>
      {children}
    </div>
  )
}
