'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  enabled: boolean
}

interface Preflight {
  title: string | null
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
}

export function Step3Preflight() {
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [title, setTitle] = useState('')
  const [targets, setTargets] = useState<RtmpTarget[] | null>(null)
  const [pinText, setPinText] = useState('')
  const [pinning, setPinning] = useState(false)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [preflightRes, targetsRes] = await Promise.all([
          fetch(`${API_BASE}/api/me/channel/preflight`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/me/rtmp-targets`, { credentials: 'include' }),
        ])
        if (!cancelled && preflightRes.ok) {
          const data = (await preflightRes.json()) as Preflight
          setPreflight(data)
          setTitle(data.title ?? '')
        }
        if (!cancelled && targetsRes.ok) {
          setTargets((await targetsRes.json()) as RtmpTarget[])
        }
      } catch {
        // render with defaults
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function patchPreflight(body: Partial<Preflight>) {
    const res = await fetch(`${API_BASE}/api/me/channel/preflight`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (res.ok) setPreflight((await res.json()) as Preflight)
  }

  async function toggleTarget(id: string, enabled: boolean) {
    setTargets((prev) => prev?.map((t) => (t.id === id ? { ...t, enabled } : t)) ?? null)
    await fetch(`${API_BASE}/api/me/rtmp-targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    })
  }

  async function pinToChat() {
    if (!pinText.trim()) return
    setPinning(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/chat/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: pinText.trim() }),
      })
      if (res.ok) {
        setPinned(true)
        setPinText('')
        setTimeout(() => setPinned(false), 2000)
      }
    } finally {
      setPinning(false)
    }
  }

  if (!preflight) return null

  return (
    <div className="studio-card studio-mb-md">
      <h4 className="broadcast-studio__card-title">Set up your broadcast</h4>

      <div className="studio-field studio-mb-md">
        <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-show-name">
          Show name
        </label>
        <input
          id="broadcast-show-name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim()) void patchPreflight({ title: title.trim() })
          }}
          placeholder="Moonrise Sessions — Live"
          className="studio-input studio-mt-sm"
        />
      </div>

      <div className="studio-grid studio-grid--2 studio-mb-md">
        <div className="studio-field">
          <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-visibility">
            Visibility
          </label>
          <select
            id="broadcast-visibility"
            value={preflight.visibility}
            onChange={(e) =>
              void patchPreflight({ visibility: e.target.value as Preflight['visibility'] })
            }
            className="studio-input studio-mt-sm"
          >
            <option value="PUBLIC">Public — anyone can listen</option>
            <option value="FAN_ONLY">Fan-subscribers only</option>
          </select>
        </div>

        <div className="studio-field">
          <span className="studio-label studio-text-muted-sm">Simulcast</span>
          <div className="broadcast-studio__targets studio-mt-sm">
            {targets === null ? null : targets.length === 0 ? (
              <a href="/dashboard/settings/multistream" className="studio-link">
                Set up a simulcast target →
              </a>
            ) : (
              targets.map((t) => (
                <label key={t.id} className="studio-label-row studio-text-sm">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => void toggleTarget(t.id, e.target.checked)}
                  />
                  {t.label}
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="studio-field">
        <label className="studio-label studio-text-muted-sm" htmlFor="broadcast-pin">
          Pin to chat (optional)
        </label>
        <div className="broadcast-studio__pin-row studio-mt-sm">
          <input
            id="broadcast-pin"
            value={pinText}
            onChange={(e) => setPinText(e.target.value)}
            placeholder="e.g. 'three new originals tonight, requests open at 23:00'"
            className="studio-input"
          />
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--secondary"
            disabled={pinning || !pinText.trim()}
            onClick={() => void pinToChat()}
          >
            {pinned ? 'Pinned ✓' : pinning ? 'Pinning…' : 'Pin'}
          </button>
        </div>
      </div>

      <label className="studio-label-row studio-text-sm studio-mt-md">
        <input
          type="checkbox"
          checked={preflight.autoArchive}
          onChange={(e) => void patchPreflight({ autoArchive: e.target.checked })}
        />
        Auto-archive this broadcast (you can edit later)
      </label>
    </div>
  )
}
