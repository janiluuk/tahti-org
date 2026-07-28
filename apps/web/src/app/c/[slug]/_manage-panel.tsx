'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useMemo, useRef, useState } from 'react'
import { StatusPill } from '@tahti/ui'
import { RTMP_PROVIDERS } from '@/lib/rtmp-provider-help'

export interface ManageStats {
  audioBitrateKbps: number | null
  listeners: number
  listenerPeak: number
  plays: number
  likes: number
  reposts: number
  liveDurationSec: number | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const REFRESH_MS = 15_000

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

type TransportAction = 'skip' | 'previous' | 'pause' | 'resume'

const TRANSPORT_BUTTONS: Array<{ action: TransportAction; label: string; icon: JSX.Element }> = [
  {
    action: 'previous',
    label: 'Play previous track',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 6h2v12H6zm3.5 6 9-6v12z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'pause',
    label: 'Stop rotation (live broadcasts are unaffected)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'resume',
    label: 'Resume rotation',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'skip',
    label: 'Play next track',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M16 6h2v12h-2zM5.5 6l9 6-9 6z" fill="currentColor" />
      </svg>
    ),
  },
]

interface FallbackCollectionOption {
  id: string
  name: string
  trackCount: number
  active: boolean
}

/** Searchable dropdown for repointing the channel's 24/7 fallback rotation at
 * a chosen Collection (or back to the default isFallback set). Collections
 * only load once the dropdown is opened — most Manage tab visits won't touch
 * this, so there's no reason to fetch it on every panel mount. */
function PlaylistSwitchDropdown({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [options, setOptions] = useState<FallbackCollectionOption[]>([])
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const loadOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/channels/${slug}/fallback-collections`, {
        credentials: 'include',
      })
      if (res.ok) setOptions((await res.json()) as FallbackCollectionOption[])
      setLoaded(true)
    } catch {
      setError('Could not load playlists')
      setLoaded(true)
    }
  }

  const activeOption = options.find((o) => o.active)
  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )

  const choose = async (collectionId: string | null) => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/channels/${slug}/fallback-collection`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId }),
      })
      if (res.ok) {
        setOptions((prev) => prev.map((o) => ({ ...o, active: o.id === collectionId })))
        setOpen(false)
        setQuery('')
      } else {
        setError('Could not switch playlist — try again')
      }
    } catch {
      setError('Could not switch playlist — try again')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="ch-manage-playlist-switch" ref={containerRef}>
      <label className="ch-manage-stats__label" htmlFor="ch-manage-playlist-switch-input">
        Playlist source
      </label>
      <div className="ch-manage-playlist-switch__combo">
        <input
          id="ch-manage-playlist-switch-input"
          type="text"
          className="ch-manage-playlist-switch__input"
          placeholder={activeOption ? activeOption.name : 'Default rotation'}
          value={query}
          disabled={pending}
          onFocus={() => {
            setOpen(true)
            if (!loaded) void loadOptions()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />
        {open && (
          <ul className="ch-manage-playlist-switch__list" role="listbox">
            <li>
              <button
                type="button"
                className="ch-manage-playlist-switch__option"
                disabled={pending}
                onClick={() => void choose(null)}
              >
                Default rotation{!activeOption ? ' (current)' : ''}
              </button>
            </li>
            {loaded && filtered.length === 0 && (
              <li className="ch-manage-playlist-switch__empty">No playlists match</li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="ch-manage-playlist-switch__option"
                  disabled={pending}
                  onClick={() => void choose(o.id)}
                >
                  {o.name} ({o.trackCount} track{o.trackCount === 1 ? '' : 's'})
                  {o.active ? ' (current)' : ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="ch-manage-transport__error">{error}</p>}
    </div>
  )
}

interface RtmpTargetStatus {
  id: string
  provider: string
  label: string
  enabled: boolean
  status: 'connected' | 'error' | 'offline' | 'disabled'
  lastError?: string
}

function rtmpProviderLabel(provider: string): string {
  return RTMP_PROVIDERS.find((p) => p.value === provider)?.label ?? provider
}

function rtmpStatusPill(status: RtmpTargetStatus['status']) {
  switch (status) {
    case 'connected':
      return (
        <StatusPill tone="green" className="ch-manage-multistream__pill">
          LIVE
        </StatusPill>
      )
    case 'error':
      return (
        <StatusPill tone="coral" className="ch-manage-multistream__pill">
          ERROR
        </StatusPill>
      )
    case 'disabled':
      return (
        <StatusPill tone="amber" className="ch-manage-multistream__pill">
          OFF
        </StatusPill>
      )
    default:
      return (
        <StatusPill tone="purple" className="ch-manage-multistream__pill">
          NOT LIVE
        </StatusPill>
      )
  }
}

/** Push status for the channel's configured YouTube/Twitch/etc. mirror
 * targets (see /dashboard/settings/multistream). Only renders once targets
 * exist — most channels have none, and the fetch is skippable in that case. */
function MultistreamStatus({ slug }: { slug: string }) {
  const [targets, setTargets] = useState<RtmpTargetStatus[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`${API_URL}/api/channels/${slug}/rtmp-status`, {
          credentials: 'include',
        })
        if (res.ok && !cancelled) setTargets((await res.json()) as RtmpTargetStatus[])
      } catch {
        // keep showing the last-known values
      }
    }
    void tick()
    const id = setInterval(tick, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [slug])

  if (!targets || targets.length === 0) return null

  return (
    <div className="ch-manage-multistream">
      <span className="ch-manage-stats__label">Multistream</span>
      <ul className="ch-manage-multistream__list">
        {targets.map((t) => (
          <li key={t.id} className="ch-manage-multistream__row">
            <span className="ch-manage-multistream__name">
              {t.label} · {rtmpProviderLabel(t.provider)}
            </span>
            {rtmpStatusPill(t.status)}
            {t.status === 'error' && t.lastError && (
              <span className="ch-manage-multistream__error">{t.lastError}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Owner/board-only tab on the channel page — live stats snapshot, refreshed
 * periodically while the tab is open, plus transport controls, a playlist
 * switch for the archive rotation, and multistream push status. Editable
 * external metadata lands in a follow-up pass. */
export function ManagePanel({ slug, initialStats }: { slug: string; initialStats: ManageStats }) {
  const [stats, setStats] = useState(initialStats)
  const [pendingAction, setPendingAction] = useState<TransportAction | null>(null)
  const [transportError, setTransportError] = useState<string | null>(null)

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(`${API_URL}/api/channels/${slug}/manage-stats`, {
          credentials: 'include',
        })
        if (res.ok) setStats((await res.json()) as ManageStats)
      } catch {
        // keep showing the last-known values
      }
    }
    const id = setInterval(tick, REFRESH_MS)
    return () => clearInterval(id)
  }, [slug])

  const runTransportAction = async (action: TransportAction) => {
    setPendingAction(action)
    setTransportError(null)
    try {
      const res = await fetch(`${API_URL}/api/channels/${slug}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setTransportError(
          res.status === 409
            ? 'Channel is not currently running'
            : res.status === 404 && action === 'previous'
              ? 'No previous track available'
              : 'Action failed — try again',
        )
      }
    } catch {
      setTransportError('Action failed — try again')
    } finally {
      setPendingAction(null)
    }
  }

  const rows: Array<{ label: string; value: string }> = [
    {
      label: 'Audio Bitrate',
      value: stats.audioBitrateKbps != null ? `${stats.audioBitrateKbps} kbps` : 'Not live',
    },
    { label: 'Listeners', value: String(stats.listeners) },
    { label: 'Listener Peak', value: String(stats.listenerPeak) },
    { label: 'Plays', value: String(stats.plays) },
    { label: 'Likes', value: String(stats.likes) },
    { label: 'Reposts', value: String(stats.reposts) },
    { label: 'Duration', value: formatDuration(stats.liveDurationSec) },
  ]

  return (
    <section className="ch-manage-panel">
      <h2 className="ch-manage-panel__title">Manage</h2>
      <dl className="ch-manage-stats">
        {rows.map((row) => (
          <div key={row.label} className="ch-manage-stats__cell">
            <dt className="ch-manage-stats__label">{row.label}</dt>
            <dd className="ch-manage-stats__value">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="ch-manage-transport" role="group" aria-label="Playback controls">
        {TRANSPORT_BUTTONS.map(({ action, label, icon }) => (
          <button
            key={action}
            type="button"
            className="ch-manage-transport__btn"
            title={label}
            aria-label={label}
            disabled={pendingAction !== null}
            onClick={() => void runTransportAction(action)}
          >
            {icon}
          </button>
        ))}
      </div>
      {transportError && <p className="ch-manage-transport__error">{transportError}</p>}
      <PlaylistSwitchDropdown slug={slug} />
      <MultistreamStatus slug={slug} />
    </section>
  )
}
