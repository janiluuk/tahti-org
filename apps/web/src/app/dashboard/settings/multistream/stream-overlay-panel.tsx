'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { Button, ButtonIcon, Panel } from '@tahti/ui'

interface StreamOverlay {
  streamOverlayTitle: string | null
  streamOverlaySubtitle: string | null
  streamOverlayCoverUrl: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** YouTube/Twitch reject audio-only RTMP, so every mirror push carries a static
 * video frame — this is what's baked into it. Distinct from each *platform's*
 * own stream title (set in YouTube Studio / Twitch dashboard, out of our
 * control over RTMP), this is Tahti's own overlay text + cover image. */
export function StreamOverlayPanel({ initial }: { initial: StreamOverlay }) {
  const [title, setTitle] = useState(initial.streamOverlayTitle ?? '')
  const [subtitle, setSubtitle] = useState(initial.streamOverlaySubtitle ?? '')
  const [coverUrl, setCoverUrl] = useState(initial.streamOverlayCoverUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/stream-overlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          streamOverlayTitle: title.trim(),
          streamOverlaySubtitle: subtitle.trim(),
          streamOverlayCoverUrl: coverUrl.trim(),
        }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? 'Failed to save')
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      className="studio-mt-lg"
      title="Stream overlay"
      description="RTMP has no built-in title metadata, so YouTube/Twitch/etc. mirrors carry a static video frame with this text and cover baked in. Leave blank to use your display name and avatar."
    >
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
      {saved && !error && (
        <p className="studio-notice studio-notice--success studio-mb-sm">Saved</p>
      )}

      <div className="studio-field">
        <label className="studio-label" htmlFor="overlay-title">
          Overlay title
        </label>
        <input
          id="overlay-title"
          type="text"
          className="studio-input"
          placeholder="Your display name"
          maxLength={80}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaved(false)
          }}
        />
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor="overlay-subtitle">
          Overlay subtitle
        </label>
        <input
          id="overlay-subtitle"
          type="text"
          className="studio-input"
          placeholder="e.g. Every Friday, 8pm CET"
          maxLength={120}
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value)
            setSaved(false)
          }}
        />
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor="overlay-cover">
          Cover image URL
        </label>
        <input
          id="overlay-cover"
          type="url"
          className="studio-input"
          placeholder="Your avatar"
          value={coverUrl}
          onChange={(e) => {
            setCoverUrl(e.target.value)
            setSaved(false)
          }}
        />
      </div>

      <Button onClick={() => void save()} disabled={saving} variant="primary">
        <ButtonIcon name="save" />
        {saving ? 'Saving…' : 'Save overlay'}
      </Button>
    </Panel>
  )
}
