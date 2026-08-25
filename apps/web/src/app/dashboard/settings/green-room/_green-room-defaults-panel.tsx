'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Panel } from '@tahti/ui'
import type { GreenRoomDefaults, GreenRoomInvitePool } from '@tahti/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

const POOL_OPTIONS: Array<{ value: GreenRoomInvitePool; label: string }> = [
  { value: 'EVERYONE', label: 'Everyone (any signed-in listener)' },
  { value: 'MODERATORS_AND_SUBS', label: 'Moderators + active fan subscribers' },
  { value: 'SUBS_ONLY', label: 'Active fan subscribers only' },
  { value: 'MANUAL_ONLY', label: 'Manual invites only (no auto-sync)' },
]

export function GreenRoomDefaultsPanel({ initial }: { initial: GreenRoomDefaults }) {
  const [defaults, setDefaults] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function patch(body: Partial<GreenRoomDefaults>) {
    setError(null)
    startTransition(async () => {
      const res = await fetch(`${API_BASE}/api/me/channel/green-room-defaults`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'Could not save green room defaults')
        return
      }
      setDefaults((await res.json()) as GreenRoomDefaults)
    })
  }

  return (
    <Panel
      title="Green room defaults"
      headerTight
      description="Backstage listen-only access before you go live. These defaults apply when a new preview session starts."
    >
      <label className="studio-label-row studio-text-sm">
        <input
          type="checkbox"
          checked={defaults.defaultEnabled}
          disabled={isPending}
          onChange={(e) => patch({ defaultEnabled: e.target.checked })}
        />
        Enable green room automatically for new broadcasts
      </label>

      <div className="studio-field studio-mt-md">
        <label className="studio-label studio-text-muted-sm" htmlFor="green-room-default-pool">
          Default invite pool
        </label>
        <select
          id="green-room-default-pool"
          className="studio-input studio-mt-sm"
          value={defaults.defaultInvitePool}
          disabled={isPending}
          onChange={(e) => patch({ defaultInvitePool: e.target.value as GreenRoomInvitePool })}
        >
          {POOL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <p className="studio-text-muted-sm studio-mt-md">
        “Members” in your profile roster are display credits only — green room invites use Tahti
        accounts from moderators and fan subscribers, or usernames you add manually.
      </p>

      {error ? <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p> : null}

      <div className="studio-actions studio-mt-md">
        <Link href="/dashboard/broadcast?step=3" className="ui-btn ui-btn--secondary ui-btn--sm">
          Open pre-flight controls
        </Link>
      </div>
    </Panel>
  )
}
