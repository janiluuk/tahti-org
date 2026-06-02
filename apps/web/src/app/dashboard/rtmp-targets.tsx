// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

'use client'

import { useState } from 'react'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  rtmpUrl: string
  alwaysMirror: boolean
  enabled: boolean
}

const PROVIDERS = [
  { value: 'YOUTUBE', label: 'YouTube Live' },
  { value: 'TWITCH', label: 'Twitch' },
  { value: 'FACEBOOK', label: 'Facebook Live' },
  { value: 'MIXCLOUD_LIVE', label: 'Mixcloud Live' },
  { value: 'CUSTOM', label: 'Custom RTMP' },
]

export default function RtmpTargetsPanel({ initial }: { initial: RtmpTarget[] }) {
  const [targets, setTargets] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ provider: 'YOUTUBE', label: '', streamKey: '', rtmpUrl: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Multistream</h2>
        {targets.length < 5 && !adding && (
          <button
            onClick={() => setAdding(true)}
            style={{ padding: '0.35rem 0.8rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'none', fontSize: '0.85rem' }}
          >
            + Add target
          </button>
        )}
      </div>

      {targets.length === 0 && !adding && (
        <p style={{ color: '#aaa', fontSize: '0.875rem' }}>
          Add a YouTube, Twitch, or custom RTMP target to simulcast your live broadcasts.
        </p>
      )}

      {targets.map((t) => (
        <div
          key={t.id}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0' }}
        >
          <span style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem' }}>
            {t.label}
            <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#888' }}>
              {PROVIDERS.find((p) => p.value === t.provider)?.label ?? t.provider}
            </span>
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#555', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={t.enabled}
              onChange={(e) => void toggleTarget(t.id, e.target.checked)}
            />
            Active
          </label>
          <button
            onClick={() => void deleteTarget(t.id)}
            style={{ padding: '0.2rem 0.5rem', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', background: 'none', color: '#dc2626', fontSize: '0.75rem' }}
          >
            Remove
          </button>
        </div>
      ))}

      {adding && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>Platform</label>
              <select
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, marginTop: '0.25rem' }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>{'Label (e.g. "My YouTube")'}</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                maxLength={64}
                style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, marginTop: '0.25rem' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>Stream Key</label>
            <input
              type="password"
              value={form.streamKey}
              onChange={(e) => setForm((f) => ({ ...f, streamKey: e.target.value }))}
              placeholder="Paste your stream key here"
              style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, marginTop: '0.25rem', fontFamily: 'monospace' }}
            />
          </div>

          {form.provider === 'CUSTOM' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>RTMP URL</label>
              <input
                value={form.rtmpUrl}
                onChange={(e) => setForm((f) => ({ ...f, rtmpUrl: e.target.value }))}
                placeholder="rtmp://live.example.com/live"
                style={{ display: 'block', width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, marginTop: '0.25rem', fontFamily: 'monospace' }}
              />
            </div>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => void addTarget()}
              disabled={saving || !form.label || !form.streamKey}
              style={{ padding: '0.4rem 0.9rem', background: '#111', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {saving ? 'Saving…' : 'Add target'}
            </button>
            <button
              onClick={() => { setAdding(false); setError(null) }}
              style={{ padding: '0.4rem 0.9rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
