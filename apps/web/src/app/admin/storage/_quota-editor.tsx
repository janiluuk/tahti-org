// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { brandTokens } from '@tahti/ui'
import { setUserQuota } from './actions'

function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024))
}

/** Inline per-user quota override — the platform-wide default (500MB) lives
 * in UserStorageQuota.quotaBytes' schema default; this PATCHes that single
 * row so a board member can grant one user more (or less) room without
 * touching the default for everyone else. */
export function QuotaEditor({ userId, quotaBytes }: { userId: string; quotaBytes: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(bytesToMb(quotaBytes)))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!editing) {
    return (
      <button
        type="button"
        className="admin-btn admin-btn--sm"
        onClick={() => {
          setValue(String(bytesToMb(quotaBytes)))
          setError(null)
          setEditing(true)
        }}
      >
        Edit quota
      </button>
    )
  }

  function save() {
    const mb = Number(value)
    if (!Number.isFinite(mb) || mb <= 0) {
      setError('Enter a positive number of MB')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await setUserQuota(userId, Math.round(mb * 1024 * 1024))
      if (!result.ok) {
        setError(result.error ?? 'Failed to update quota')
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="admin-input"
        style={{ width: '5rem' }}
        disabled={pending}
      />
      <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>MB</span>
      <button type="button" className="admin-btn admin-btn--sm" onClick={save} disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--sm"
        onClick={() => setEditing(false)}
        disabled={pending}
      >
        Cancel
      </button>
      {error && (
        <span style={{ color: brandTokens.color.semantic.danger, fontSize: '0.75rem' }}>
          {error}
        </span>
      )}
    </div>
  )
}
