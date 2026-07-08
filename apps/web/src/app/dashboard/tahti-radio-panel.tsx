// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export function TahtiRadioPanel() {
  const [optOut, setOptOut] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/me/channel/meta-stream`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { metaStreamOptOut: boolean } | null) => {
        if (data) setOptOut(data.metaStreamOptOut)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function toggle(e: React.ChangeEvent<HTMLInputElement>) {
    const newVal = e.target.checked
    setOptOut(newVal)
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/meta-stream`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optOut: newVal }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setMsg(err.error ?? 'Save failed')
        setOptOut(!newVal)
      } else {
        setMsg(newVal ? 'Opted out of Tahti Radio.' : 'Your channel is included in Tahti Radio.')
      }
    } catch {
      setMsg('Network error — please try again.')
      setOptOut(!newVal)
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Panel
      title={
        <div className="tahti-radio-panel__header">
          <h2 className="ui-heading ui-heading--2">Tahti Radio</h2>
          <a
            href="https://tahti.live/radio"
            target="_blank"
            rel="noreferrer"
            className="studio-text-muted-sm studio-link"
          >
            What is Tahti Radio?
          </a>
        </div>
      }
      headerTight
      data-testid="tahti-radio-panel"
    >
      <p className="studio-text-muted-sm studio-mt-xs studio-mb-sm">
        Tahti Radio is an auto-curated meta-stream built from members&apos; archive. Your channel is
        included by default.
      </p>
      <label className="studio-toggle-row">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={optOut}
          onChange={toggle}
          disabled={saving}
        />
        <span className="studio-toggle-label">
          {optOut ? 'Opted out — not included in Tahti Radio' : 'Included in Tahti Radio'}
        </span>
      </label>
      {msg && (
        <p
          className={`studio-text-sm studio-mt-xs ${msg.includes('failed') || msg.includes('error') ? 'studio-text-error' : 'studio-text-success'}`}
        >
          {msg}
        </p>
      )}
      <p className="studio-text-muted-sm studio-mt-sm">
        Opting out removes all your archive items from the meta-stream rotation. Individual items
        can also be excluded in the Archive editor.
      </p>
    </Panel>
  )
}
