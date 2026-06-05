// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import {
  RTMP_PROVIDERS,
  RTMP_PROVIDER_HELP,
  type RtmpProviderValue,
} from '../../lib/rtmp-provider-help'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  rtmpUrl: string
  alwaysMirror: boolean
  enabled: boolean
}

const GUIDE_PATH = '/help/multistream'

export default function RtmpTargetsPanel({ initial }: { initial: RtmpTarget[] }) {
  const [targets, setTargets] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    provider: 'YOUTUBE' as RtmpProviderValue,
    label: '',
    streamKey: '',
    rtmpUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const help = RTMP_PROVIDER_HELP[form.provider]

  async function addTarget() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/me/rtmp-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? 'Failed to add target')
      }
      const target = (await res.json()) as RtmpTarget
      setTargets((prev) => [...prev, target])
      setAdding(false)
      setForm({ provider: 'YOUTUBE', label: '', streamKey: '', rtmpUrl: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTarget(id: string, enabled: boolean) {
    const res = await fetch(`/api/me/rtmp-targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) {
      setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
    }
  }

  async function deleteTarget(id: string) {
    if (!confirm('Remove this multistream target?')) return
    const res = await fetch(`/api/me/rtmp-targets/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setTargets((prev) => prev.filter((t) => t.id !== id))
    }
  }

  return (
    <div className="studio-panel-section">
      <div className="studio-row--between studio-mb-sm">
        <h2 className="studio-section-heading studio-m-0">Multistream (simulcast)</h2>
        {targets.length < 5 && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="studio-btn-ghost">
            + Add destination
          </button>
        )}
      </div>

      <p className="studio-help">
        Send one stream from OBS to Tahti; we mirror the same live audio to Twitch, YouTube, and
        other services. For each destination, paste the <strong>stream key</strong> from that
        platform&apos;s creator dashboard — not a Tahti password and not a Google/Twitch API key.
        See the <a href={GUIDE_PATH}>multistream setup guide</a> for each platform.
      </p>

      {targets.length === 0 && !adding && (
        <p className="studio-empty">
          No destinations yet. Add YouTube, Twitch, Kick, Facebook, TikTok, Mixcloud, Instagram
          (RTMP), or a custom RTMP URL.
        </p>
      )}

      {targets.map((t) => (
        <div key={t.id} className="studio-item-row">
          <span className="studio-flex-1 studio-stat-box-title">
            {t.label}
            <span className="studio-badge studio-text-muted-sm">
              {RTMP_PROVIDERS.find((p) => p.value === t.provider)?.label ?? t.provider}
            </span>
          </span>
          <label className="studio-label-row studio-text-sm">
            <input
              type="checkbox"
              checked={t.enabled}
              onChange={(e) => void toggleTarget(t.id, e.target.checked)}
            />
            Active
          </label>
          <button
            type="button"
            onClick={() => void deleteTarget(t.id)}
            className="studio-btn-danger"
          >
            Remove
          </button>
        </div>
      ))}

      {adding && (
        <div className="studio-subsection studio-mt-lg">
          <div className="studio-grid studio-grid--2 studio-mb-md">
            <div className="studio-field">
              <label className="studio-label studio-text-muted-sm">Platform</label>
              <select
                value={form.provider}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider: e.target.value as RtmpProviderValue }))
                }
                className="studio-input studio-mt-sm"
              >
                {RTMP_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="studio-field">
              <label className="studio-label studio-text-muted-sm">
                Label (e.g. &quot;My Twitch&quot;)
              </label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                maxLength={64}
                className="studio-input studio-mt-sm"
              />
            </div>
          </div>

          <div className="studio-info-callout">
            <strong>Where to get the key:</strong> {help.keySteps}
            {help.docUrl && (
              <>
                {' '}
                <a href={help.docUrl} target="_blank" rel="noopener noreferrer">
                  Open platform ↗
                </a>
              </>
            )}
            {form.provider !== 'CUSTOM' && (
              <div className="studio-text-muted-sm studio-mt-sm studio-font-mono">
                Tahti ingest: {help.ingestHint}
              </div>
            )}
          </div>

          <div className="studio-field">
            <label className="studio-label studio-text-muted-sm">
              Stream key from {RTMP_PROVIDERS.find((p) => p.value === form.provider)?.label}
            </label>
            <input
              type="password"
              value={form.streamKey}
              onChange={(e) => setForm((f) => ({ ...f, streamKey: e.target.value }))}
              placeholder="Paste stream key — never share publicly"
              autoComplete="off"
              className="studio-input studio-mt-sm studio-font-mono"
            />
          </div>

          {form.provider === 'CUSTOM' && (
            <div className="studio-field">
              <label className="studio-label studio-text-muted-sm">
                RTMP URL (required for Custom)
              </label>
              <input
                value={form.rtmpUrl}
                onChange={(e) => setForm((f) => ({ ...f, rtmpUrl: e.target.value }))}
                placeholder="rtmp://live.example.com/live"
                className="studio-input studio-mt-sm studio-font-mono"
              />
            </div>
          )}

          {error && <p className="studio-text-error studio-m-0 studio-mb-sm">{error}</p>}

          <div className="studio-actions">
            <button
              type="button"
              onClick={() => void addTarget()}
              disabled={saving || !form.label || !form.streamKey}
              className="studio-btn-dark"
            >
              {saving ? 'Saving…' : 'Save destination'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
              className="studio-btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
