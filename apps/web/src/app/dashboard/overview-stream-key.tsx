// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  rtmpKey: string
  icecastMount: string
  icecastPass: string
}

function masked(s: string) {
  return s.slice(0, 6) + '●'.repeat(Math.min(12, Math.max(4, s.length - 6)))
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button type="button" className="db-cred-copy-btn" onClick={copy} aria-label={`Copy ${label}`}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

export function OverviewStreamKey({ rtmpKey, icecastMount, icecastPass }: Props) {
  return (
    <div className="db-stream-panel">
      <div className="db-stream-panel__label">RTMP stream key</div>
      <div className="db-cred-row">
        <span className="db-cred-value" title="RTMP stream key">
          {masked(rtmpKey)}
        </span>
        <CopyBtn value={rtmpKey} label="RTMP stream key" />
        <Link href="/dashboard#broadcast" className="db-cred-copy-btn">
          Rotate
        </Link>
      </div>
      <div className="db-stream-panel__label db-stream-panel__label--spaced">Icecast source</div>
      <div className="db-cred-row">
        <span className="db-cred-value" title="Icecast source password">
          {icecastMount} · {masked(icecastPass)}
        </span>
        <CopyBtn value={icecastPass} label="Icecast password" />
        <Link href="/help/broadcast" className="db-cred-copy-btn">
          Guide
        </Link>
      </div>
    </div>
  )
}
