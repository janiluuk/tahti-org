// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button } from './button'
import { Code } from './layout'

export interface CopyRowProps {
  label: string
  value: string
  copyLabel?: string
  copiedLabel?: string
}

export function CopyRow({
  label,
  value,
  copyLabel = 'Copy',
  copiedLabel = 'Copied!',
}: CopyRowProps) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="ui-copy-row">
      <span className="ui-copy-row__label">{label}</span>
      <Code className="ui-copy-row__value">{value}</Code>
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  )
}
