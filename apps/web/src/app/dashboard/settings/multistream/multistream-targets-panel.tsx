'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Fragment, useState } from 'react'
import {
  ButtonIcon,
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  StatusPill,
  brandTokens,
  Button,
} from '@tahti/ui'
import {
  RTMP_PROVIDERS,
  RTMP_PROVIDER_HELP,
  type RtmpProviderValue,
} from '../../../../lib/rtmp-provider-help'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  rtmpUrl: string
  alwaysMirror: boolean
  enabled: boolean
  keyLast4?: string
}

const TARGET_COLUMNS = 'auto 1fr auto auto'
const GUIDE_PATH = '/help/multistream'
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const MAX_TARGETS = 5

const { platformBrand, base } = brandTokens.color

const PROVIDER_TILE: Record<string, { bg: string; fg: string; glyph: string }> = {
  TWITCH: { bg: platformBrand.twitch, fg: base.white, glyph: 'TW' },
  YOUTUBE: { bg: platformBrand.youtube, fg: base.white, glyph: 'YT' },
  KICK: { bg: platformBrand.kick, fg: platformBrand.kickFg, glyph: 'KI' },
  MIXCLOUD_LIVE: { bg: platformBrand.mixcloud, fg: base.white, glyph: 'MX' },
  FACEBOOK: { bg: platformBrand.facebook, fg: base.white, glyph: 'FB' },
  TIKTOK: { bg: platformBrand.tiktok, fg: base.white, glyph: 'TT' },
  INSTAGRAM: { bg: platformBrand.instagram, fg: base.white, glyph: 'IG' },
  CUSTOM: { bg: 'var(--border)', fg: 'var(--text)', glyph: 'RT' },
}

function providerLabel(provider: string): string {
  return RTMP_PROVIDERS.find((p) => p.value === provider)?.label ?? provider
}

export function MultistreamTargetsPanel({
  initial,
  channelLive,
}: {
  initial: RtmpTarget[]
  channelLive: boolean
}) {
  const [targets, setTargets] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    provider: 'YOUTUBE' as RtmpProviderValue,
    label: '',
    streamKey: '',
    rtmpUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const help = RTMP_PROVIDER_HELP[form.provider]

  async function addTarget() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/rtmp-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? 'Failed to add target')
      }
      const target = (await res.json()) as RtmpTarget
      setTargets((prev) => [...prev, { ...target, keyLast4: form.streamKey.slice(-4) }])
      setAdding(false)
      setForm({ provider: 'YOUTUBE', label: '', streamKey: '', rtmpUrl: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTarget(id: string, enabled: boolean) {
    setToggleError(null)
    const res = await fetch(`${API_BASE}/api/me/rtmp-targets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) {
      setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
    } else {
      setToggleError('Failed to update — try again.')
    }
  }

  async function deleteTarget(id: string) {
    if (!confirm('Remove this multistream target?')) return
    const res = await fetch(`${API_BASE}/api/me/rtmp-targets/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok || res.status === 204) {
      setTargets((prev) => prev.filter((t) => t.id !== id))
      if (editingId === id) setEditingId(null)
    }
  }

  return (
    <>
      {toggleError && (
        <p className="studio-notice studio-notice--error studio-mb-sm">{toggleError}</p>
      )}
      <DataRowList>
        <DataRowListHeader columns={TARGET_COLUMNS}>
          <span />
          <span>Target</span>
          <span>Status</span>
          <span />
        </DataRowListHeader>
        {targets.length === 0 && (
          <DataRowListEmpty>
            No destinations yet. Add YouTube, Twitch, Kick, Facebook, TikTok, Mixcloud, Instagram
            (RTMP), or a custom RTMP URL.
          </DataRowListEmpty>
        )}
        {targets.map((t) => {
          const tile = PROVIDER_TILE[t.provider] ?? PROVIDER_TILE.CUSTOM
          const mirroring = t.enabled && channelLive
          return (
            <Fragment key={t.id}>
              <DataRowListRow columns={TARGET_COLUMNS}>
                <span
                  className="multistream-tile"
                  style={{ background: tile.bg, color: tile.fg }}
                  aria-hidden
                >
                  {tile.glyph}
                </span>
                <span>
                  <span className="multistream-target__name">{t.label}</span>
                  <span className="multistream-target__meta">
                    {t.rtmpUrl} · key ••••••{t.keyLast4 ?? '????'}
                  </span>
                </span>
                <StatusPill tone={mirroring ? 'green' : 'amber'}>
                  {mirroring ? 'MIRRORING' : 'PAUSED'}
                </StatusPill>
                <Button
                  onClick={() => setEditingId((prev) => (prev === t.id ? null : t.id))}
                  variant="secondary"
                  size="sm"
                >
                  Edit
                </Button>
              </DataRowListRow>
              {editingId === t.id && (
                <DataRowListRow columns="1fr">
                  <EditTargetForm
                    target={t}
                    providerLabel={providerLabel(t.provider)}
                    onToggle={(enabled) => void toggleTarget(t.id, enabled)}
                    onDelete={() => void deleteTarget(t.id)}
                    onClose={() => setEditingId(null)}
                  />
                </DataRowListRow>
              )}
            </Fragment>
          )
        })}
      </DataRowList>

      <div className="multistream-footer">
        {targets.length < MAX_TARGETS && !adding && (
          <Button onClick={() => setAdding(true)} variant="primary" size="sm">
            + Add target
          </Button>
        )}
        <p className="admin-footnote multistream-footer__note">
          The mirror includes a video track showing your cover art with the current title —
          YouTube/Twitch see a normal video stream, not audio-only. Guide:{' '}
          <a href={GUIDE_PATH}>{GUIDE_PATH}</a>
        </p>
      </div>

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

          {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}

          <div className="studio-actions">
            <Button
              onClick={() => void addTarget()}
              disabled={saving || !form.label || !form.streamKey}
              variant="primary"
              size="sm"
            >
              <ButtonIcon name="save" />
              {saving ? 'Saving…' : 'Save destination'}
            </Button>
            <Button
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function EditTargetForm({
  target,
  providerLabel: providerName,
  onToggle,
  onDelete,
  onClose,
}: {
  target: RtmpTarget
  providerLabel: string
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [label, setLabel] = useState(target.label)
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function reveal() {
    setRevealing(true)
    setRevealError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/rtmp-targets/${target.id}/stream-key`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Could not reveal stream key')
      const data = (await res.json()) as { streamKey: string }
      setRevealed(data.streamKey)
    } catch (e) {
      setRevealError(e instanceof Error ? e.message : 'Error')
    } finally {
      setRevealing(false)
    }
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const body: Record<string, string> = {}
      if (label.trim() && label.trim() !== target.label) body.label = label.trim()
      if (newKey.trim()) body.streamKey = newKey.trim()
      if (Object.keys(body).length === 0) {
        onClose()
        return
      }
      const res = await fetch(`${API_BASE}/api/me/rtmp-targets/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? 'Failed to save')
      }
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="multistream-edit">
      <div className="studio-grid studio-grid--2 studio-mb-md">
        <div className="studio-field">
          <label className="studio-label studio-text-muted-sm">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={64}
            className="studio-input studio-mt-sm"
          />
        </div>
        <label className="studio-label-row studio-text-sm studio-mt-lg">
          <input
            type="checkbox"
            checked={target.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Active ({providerName})
        </label>
      </div>

      <div className="studio-field studio-mb-md">
        <label className="studio-label studio-text-muted-sm">Stream key</label>
        {revealed ? (
          <div className="studio-text-muted-sm studio-mt-sm studio-font-mono">{revealed}</div>
        ) : (
          <div className="studio-mt-sm">
            <Button
              onClick={() => void reveal()}
              disabled={revealing}
              variant="secondary"
              size="sm"
            >
              {revealing ? 'Revealing…' : `Reveal (••••••${target.keyLast4 ?? '????'})`}
            </Button>
          </div>
        )}
        {revealError && <p className="studio-text-error studio-m-0 studio-mt-sm">{revealError}</p>}
        <input
          type="password"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Paste a new stream key to rotate it"
          autoComplete="off"
          className="studio-input studio-mt-sm studio-font-mono"
        />
      </div>

      {saveError && <p className="studio-notice studio-notice--error studio-mb-sm">{saveError}</p>}

      <div className="studio-actions">
        <Button onClick={() => void save()} disabled={saving} variant="primary" size="sm">
          <ButtonIcon name="save" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button onClick={onClose} variant="secondary" size="sm">
          Close
        </Button>
        <Button onClick={onDelete} variant="danger" size="sm">
          <ButtonIcon name="trash" />
          Remove
        </Button>
      </div>
    </div>
  )
}
