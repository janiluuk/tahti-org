// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { Panel, Button } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''
const CHECK_DEBOUNCE_MS = 400

type Availability = {
  available: boolean
  reason?: 'taken' | 'reserved' | 'recently_released'
} | null

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ChannelSlugPanel({ initialSlug }: { initialSlug: string }) {
  const [slug, setSlug] = useState(initialSlug)
  const [input, setInput] = useState(initialSlug)
  const [checking, setChecking] = useState(false)
  const [availability, setAvailability] = useState<Availability>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newRtmpKey, setNewRtmpKey] = useState<string | null>(null)
  const [redirectExpiresAt, setRedirectExpiresAt] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const trimmed = input.trim().toLowerCase()
    setAvailability(null)
    if (trimmed === slug || trimmed.length < 2) return
    if (!/^[a-z0-9-]+$/.test(trimmed)) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setChecking(true)
      fetch(`${API_BASE}/api/me/channel/slug-available?slug=${encodeURIComponent(trimmed)}`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Availability) => setAvailability(data))
        .catch(() => setAvailability(null))
        .finally(() => setChecking(false))
    }, CHECK_DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [input, slug])

  async function save() {
    const trimmed = input.trim().toLowerCase()
    if (trimmed === slug || !availability?.available) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/slug`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: trimmed }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        slug?: string
        rtmpStreamKey?: string
        previousSlugRedirectExpiresAt?: string | null
        error?: string
      }
      if (!res.ok || !data.slug) {
        setError(data.error ?? 'Could not change your username')
        return
      }
      setSlug(data.slug)
      setInput(data.slug)
      setAvailability(null)
      if (data.rtmpStreamKey) setNewRtmpKey(data.rtmpStreamKey)
      setRedirectExpiresAt(data.previousSlugRedirectExpiresAt ?? null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const trimmed = input.trim().toLowerCase()
  const changed = trimmed !== slug && trimmed.length >= 2
  const canSave = changed && availability?.available === true && !saving

  return (
    <Panel title="Username & address" headerTight>
      <p className="studio-text-muted-sm studio-mt-xs studio-mb-sm">
        Your <strong>@{slug}</strong> handle and <strong>{slug}.tahti.live</strong> address stay
        linked. Changing them issues a new RTMP stream key — update your broadcast software
        afterward.
      </p>
      <div className="studio-inline-form">
        <span className="studio-text-muted-sm">@</span>
        <input
          type="text"
          className="studio-input studio-input-sm"
          value={input}
          onChange={(e) => setInput(e.target.value.toLowerCase().replace(/_/g, '-'))}
          maxLength={32}
          aria-label="Username"
        />
        <span className="studio-text-muted-sm">→ https://{trimmed || '…'}.tahti.live</span>
        <Button onClick={() => void save()} disabled={!canSave} variant="secondary" size="sm">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {changed && (
        <p className="studio-text-sm studio-mt-xs">
          {checking
            ? 'Checking availability…'
            : availability?.available === true
              ? '✓ Available'
              : availability?.reason === 'reserved'
                ? '✗ That username is reserved'
                : availability?.reason === 'taken'
                  ? '✗ That username is already taken'
                  : availability?.reason === 'recently_released'
                    ? '✗ That username was recently released by another artist and isn’t available yet'
                    : null}
        </p>
      )}
      {changed && availability?.available === true && (
        <p className="studio-text-muted-sm studio-mt-xs">
          Your current address, <strong>{slug}.tahti.live</strong>, and profile{' '}
          <strong>/u/{slug}</strong> will redirect here for 30 days, then become available to other
          artists.
        </p>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
      {newRtmpKey && (
        <p className="studio-notice studio-notice--success studio-mt-xs">
          Username changed to <strong>@{slug}</strong>. Your new RTMP stream key is{' '}
          <code>{newRtmpKey}</code> — update your broadcast software before you next go live.
          {redirectExpiresAt && (
            <> Your old address redirects here until {formatExpiry(redirectExpiresAt)}.</>
          )}
        </p>
      )}
    </Panel>
  )
}
