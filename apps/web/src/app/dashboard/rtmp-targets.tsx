// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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
    <div
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <h2 style={{ margin: 0 }}>Multistream (simulcast)</h2>
        {targets.length < 5 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              padding: '0.35rem 0.8rem',
              border: '1px solid #ccc',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'none',
              fontSize: '0.85rem',
            }}
          >
            + Add destination
          </button>
        )}
      </div>

      <p style={{ color: '#555', fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
        Send one stream from OBS to Tahti; we mirror the same live audio to Twitch, YouTube, and
        other services. For each destination, paste the <strong>stream key</strong> from that
        platform&apos;s creator dashboard — not a Tahti password and not a Google/Twitch API key.
        See the <a href={GUIDE_PATH}>multistream setup guide</a> for each platform.
      </p>

      {targets.length === 0 && !adding && (
        <p style={{ color: '#aaa', fontSize: '0.875rem' }}>
          No destinations yet. Add YouTube, Twitch, Kick, Facebook, TikTok, Mixcloud, Instagram
          (RTMP), or a custom RTMP URL.
        </p>
      )}

      {targets.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.6rem 0',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <span style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem' }}>
            {t.label}
            <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#888' }}>
              {RTMP_PROVIDERS.find((p) => p.value === t.provider)?.label ?? t.provider}
            </span>
          </span>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem',
              color: '#555',
              cursor: 'pointer',
            }}
          >
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
            style={{
              padding: '0.2rem 0.5rem',
              border: '1px solid #fca5a5',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'none',
              color: '#dc2626',
              fontSize: '0.75rem',
            }}
          >
            Remove
          </button>
        </div>
      ))}

      {adding && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fafafa',
            borderRadius: 6,
            border: '1px solid #eee',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>Platform</label>
              <select
                value={form.provider}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider: e.target.value as RtmpProviderValue }))
                }
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  marginTop: '0.25rem',
                }}
              >
                {RTMP_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>
                Label (e.g. &quot;My Twitch&quot;)
              </label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                maxLength={64}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  marginTop: '0.25rem',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: '#eff6ff',
              borderRadius: 4,
              fontSize: '0.8rem',
              color: '#1e3a5f',
              lineHeight: 1.45,
            }}
          >
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
              <div style={{ marginTop: '0.35rem', color: '#64748b', fontFamily: 'monospace' }}>
                Tahti ingest: {help.ingestHint}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#555' }}>
              Stream key from {RTMP_PROVIDERS.find((p) => p.value === form.provider)?.label}
            </label>
            <input
              type="password"
              value={form.streamKey}
              onChange={(e) => setForm((f) => ({ ...f, streamKey: e.target.value }))}
              placeholder="Paste stream key — never share publicly"
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.4rem',
                border: '1px solid #ccc',
                borderRadius: 4,
                marginTop: '0.25rem',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {form.provider === 'CUSTOM' && (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#555' }}>
                RTMP URL (required for Custom)
              </label>
              <input
                value={form.rtmpUrl}
                onChange={(e) => setForm((f) => ({ ...f, rtmpUrl: e.target.value }))}
                placeholder="rtmp://live.example.com/live"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  marginTop: '0.25rem',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          )}

          {error && (
            <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => void addTarget()}
              disabled={saving || !form.label || !form.streamKey}
              style={{
                padding: '0.4rem 0.9rem',
                background: '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {saving ? 'Saving…' : 'Save destination'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
              style={{
                padding: '0.4rem 0.9rem',
                background: 'none',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
