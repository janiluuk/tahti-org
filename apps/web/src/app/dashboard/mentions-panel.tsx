// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface MutedUser {
  username: string
  displayName: string
}

interface Settings {
  mentionsEnabled: boolean
  publicMentionsEnabled: boolean
  muted: MutedUser[]
}

export function MentionsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [muteInput, setMuteInput] = useState('')
  const [muteError, setMuteError] = useState<string | null>(null)
  const [muteMessage, setMuteMessage] = useState<string | null>(null)
  const [muting, setMuting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/me/mentions/settings`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Settings | null) => {
        if (data) setSettings(data)
      })
      .catch(() => {})
  }, [])

  async function patchSettings(
    patch: Partial<Pick<Settings, 'mentionsEnabled' | 'publicMentionsEnabled'>>,
  ) {
    if (!settings) return
    setSaveError(null)
    const optimistic = { ...settings, ...patch }
    setSettings(optimistic)
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/mentions/settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        setSettings(settings)
        setSaveError('Failed to save — try again.')
      }
    } catch {
      setSettings(settings)
      setSaveError('Failed to save — try again.')
    } finally {
      setSaving(false)
    }
  }

  async function muteHandle(e: React.FormEvent) {
    e.preventDefault()
    const handle = muteInput.trim().replace(/^@/, '')
    if (!handle) return
    setMuteError(null)
    setMuteMessage(null)
    setMuting(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/mentions/mute/${encodeURIComponent(handle)}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setMuteError(err.error ?? 'Could not mute user')
      } else {
        setMuteInput('')
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                muted: [
                  ...prev.muted.filter((m) => m.username !== handle),
                  { username: handle, displayName: handle },
                ],
              }
            : prev,
        )
        setMuteMessage(`@${handle} muted.`)
      }
    } catch {
      setMuteError('Network error')
    } finally {
      setMuting(false)
    }
  }

  async function unmuteHandle(username: string) {
    setMuteError(null)
    setSettings((prev) =>
      prev ? { ...prev, muted: prev.muted.filter((m) => m.username !== username) } : prev,
    )
    const res = await fetch(`${API_BASE}/api/me/mentions/mute/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    if (res?.ok) {
      setMuteMessage(`@${username} unmuted.`)
    } else {
      setMuteError('Failed to unmute — try again.')
    }
  }

  if (!settings) {
    return (
      <Panel
        title="Mentions"
        headerTight
        description="Control who can @mention you and manage your mute list."
      >
        <p className="studio-text-muted-sm">Loading…</p>
      </Panel>
    )
  }

  return (
    <Panel
      title="Mentions"
      headerTight
      description="Control who can @mention you and manage your mute list."
    >
      <div className="mentions-settings studio-mt-sm">
        <label className="studio-toggle-row">
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={settings.mentionsEnabled}
            onChange={(e) => patchSettings({ mentionsEnabled: e.target.checked })}
            disabled={saving}
          />
          <span className="studio-toggle-label">Enable mentions</span>
        </label>
        <p className="studio-text-muted-sm studio-mt-xs studio-mb-sm">
          When enabled, other Tahti members can @mention you in their bio and posts.
        </p>
        {saveError && <p className="studio-notice studio-notice--error">{saveError}</p>}

        {settings.mentionsEnabled && (
          <>
            <label className="studio-toggle-row">
              <input
                type="checkbox"
                className="studio-toggle-checkbox"
                checked={settings.publicMentionsEnabled}
                onChange={(e) => patchSettings({ publicMentionsEnabled: e.target.checked })}
                disabled={saving}
              />
              <span className="studio-toggle-label">Show mentions on public profile</span>
            </label>
            <p className="studio-text-muted-sm studio-mt-xs studio-mb-md">
              When enabled, a &ldquo;mentioned by&rdquo; section appears on your public artist page.
            </p>
          </>
        )}

        <div className="mentions-mute-section">
          <div className="studio-label studio-mb-sm">Muted artists</div>
          {settings.muted.length === 0 ? (
            <p className="studio-text-muted-sm">No muted artists.</p>
          ) : (
            <ul className="studio-list studio-mb-sm">
              {settings.muted.map((m) => (
                <li key={m.username} className="studio-item-row--list">
                  <span className="studio-flex-1">
                    {m.displayName !== m.username ? (
                      <>
                        {m.displayName} <span className="studio-text-muted-sm">@{m.username}</span>
                      </>
                    ) : (
                      <span>@{m.username}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                    onClick={() => unmuteHandle(m.username)}
                  >
                    Unmute
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={muteHandle} className="studio-inline-form studio-mt-sm">
            <input
              type="text"
              className="studio-input studio-input-sm"
              value={muteInput}
              onChange={(e) => setMuteInput(e.target.value)}
              placeholder="@username"
              aria-label="Mute artist by username"
              maxLength={40}
            />
            <button
              type="submit"
              className="ui-btn ui-btn--sm ui-btn--secondary"
              disabled={muting || !muteInput.trim()}
            >
              {muting ? 'Muting…' : 'Mute'}
            </button>
          </form>
          {muteError && (
            <p className="studio-notice studio-notice--error studio-mt-xs">{muteError}</p>
          )}
          {muteMessage && (
            <p className="studio-notice studio-notice--success studio-mt-xs">{muteMessage}</p>
          )}
        </div>
      </div>
    </Panel>
  )
}
