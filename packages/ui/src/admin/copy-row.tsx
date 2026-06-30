// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button } from './button'
import { Code } from './layout'

export interface CopyRowProps {
  label: string
  value: string
  copyLabel?: string
  copiedLabel?: string
  /** Mask the value until explicitly revealed. Use for stream keys/passwords — never render secrets in the DOM on first paint. */
  secret?: boolean
}

const MASK = '••••••••••••••••••••'

export function CopyRow({
  label,
  value,
  copyLabel = 'Copy',
  copiedLabel = 'Copied!',
  secret = false,
}: CopyRowProps) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(!secret)

  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="ui-copy-row">
      <span className="ui-copy-row__label">{label}</span>
      <Code className="ui-copy-row__value">{revealed ? value : MASK}</Code>
      {secret && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? 'Hide' : 'Reveal'}
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={copy}>
        {copied ? copiedLabel : copyLabel}
      </Button>
    </div>
  )
}
