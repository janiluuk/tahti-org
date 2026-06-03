// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean
}

export function Textarea({ mono, className, ...props }: TextareaProps) {
  return (
    <textarea className={cn('ui-textarea', mono && 'ui-textarea--mono', className)} {...props} />
  )
}
