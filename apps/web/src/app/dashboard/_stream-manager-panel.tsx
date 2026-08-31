'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, StatusPill } from '@tahti/ui'
import ChatPanel from '@/app/c/[slug]/chat-panel'
import { resolveChannelUrl } from '@/lib/app-url'
import { RTMP_PROVIDERS } from '@/lib/rtmp-provider-help'
import { endBroadcast } from './actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const STATS_POLL_MS = 5000
const MULTISTREAM_POLL_MS = 15000
/** How long the signal must actually be down before the "Reconnecting…" pill
 * shows — signalConnected comes straight from a poll of the live icecast
 * mountpoint, which can report a false negative for a single cycle without
 * the stream having genuinely dropped. Matches the chat WS panel's own
 * RECONNECT_BANNER_DELAY_MS debounce (apps/web/src/app/c/[slug]/chat-panel.tsx)
 * — same reasoning, this one just had no debounce at all before. */
const SIGNAL_DOWN_BANNER_DELAY_MS = 8000

interface StreamStats {
  audioBitrateKbps: number | null
  signalConnected: boolean
  listeners: number
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
      return <StatusPill tone="green">LIVE</StatusPill>
    case 'error':
      return <StatusPill tone="coral">ERROR</StatusPill>
    case 'disabled':
      return <StatusPill tone="amber">OFF</StatusPill>
    default:
      return <StatusPill tone="purple">NOT LIVE</StatusPill>
  }
}

/** Push status for the channel's configured multistream (YouTube/Twitch/etc.)
 * targets — only renders once targets exist, since most channels have none. */
function MultistreamStatus({ slug }: { slug: string }) {
  const [targets, setTargets] = useState<RtmpTargetStatus[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/rtmp-status`, {
          credentials: 'include',
        })
        if (res.ok && !cancelled) setTargets((await res.json()) as RtmpTargetStatus[])
      } catch {
        // keep showing the last-known values
      }
    }
    void tick()
    const id = window.setInterval(tick, MULTISTREAM_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [slug])

  if (!targets || targets.length === 0) return null

  return (
    <ul className="stream-mgr-panel__multistream">
      {targets.map((t) => (
        <li key={t.id} className="stream-mgr-panel__multistream-row">
          <span className="stream-mgr-panel__multistream-name">
            {t.label} · {rtmpProviderLabel(t.provider)}
          </span>
          {rtmpStatusPill(t.status)}
        </li>
      ))}
    </ul>
  )
}

/** Status + listener count + live chat + end-stream, with no modal chrome of
 * its own — the shared body for both the top-nav stream manager modal
 * (_stream-manager-modal.tsx) and the dashboard home hero's inline live view
 * (_channel-hero.tsx), so "what's happening on my stream right now" looks
 * and behaves the same wherever you open it from. */
export function StreamManagerPanel({
  slug,
  displayName,
  onEnded,
}: {
  slug: string
  displayName?: string
  /** Called after a successful end-stream, before the router refresh that
   * flips every isLive-derived UI (top-nav icon, this panel itself) back. */
  onEnded?: () => void
}) {
  const router = useRouter()
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignalDown, setShowSignalDown] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/manage-stats`, {
          credentials: 'include',
        })
        if (res.ok && !cancelled) {
          const data = (await res.json()) as StreamStats
          setStats(data)
        }
      } catch {
        // ignore polling errors — keep showing the last known values
      }
    }
    poll()
    const id = window.setInterval(poll, STATS_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [slug])

  // Debounced separately from `stats` itself — flipping back to connected
  // clears this immediately (good news needs no delay), but going down only
  // shows the pill once it's stayed down for SIGNAL_DOWN_BANNER_DELAY_MS, so
  // one flaky poll cycle doesn't flicker it on and off. Keyed on the boolean
  // itself, not the `stats` object — a fresh object comes in every 5s poll
  // even when signalConnected hasn't changed, which would otherwise restart
  // this timer before it ever reaches an 8s delay.
  const signalConnected = stats?.signalConnected ?? true
  useEffect(() => {
    if (signalConnected) {
      setShowSignalDown(false)
      return
    }
    const timer = window.setTimeout(() => setShowSignalDown(true), SIGNAL_DOWN_BANNER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [signalConnected])

  async function handleEndStream() {
    if (!confirm('End your live broadcast now?')) return
    setError(null)
    setEnding(true)
    try {
      const result = await endBroadcast()
      if (result.ok) {
        onEnded?.()
        router.refresh()
      } else {
        setError(result.error ?? 'Could not end broadcast')
      }
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="stream-mgr-panel">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="stream-mgr-panel__header">
        <div>
          <div className="stream-mgr-panel__title">
            <span className="signal-dot" aria-hidden />
            Stream manager
          </div>
          <p className="stream-mgr-panel__meta">
            <Link href={resolveChannelUrl(slug)} target="_blank" rel="noopener noreferrer">
              View public channel →
            </Link>
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--danger ui-btn--sm"
          disabled={ending}
          onClick={handleEndStream}
        >
          {ending ? 'Ending…' : '■ End stream'}
        </button>
      </div>

      <div className="stream-mgr-panel__stats" role="group" aria-label="Live stream status">
        <div className="stream-mgr-panel__stat">
          <span className="stream-mgr-panel__stat-label">Signal</span>
          <span className="stream-mgr-panel__stat-value">
            {stats == null ? (
              '—'
            ) : stats.signalConnected || !showSignalDown ? (
              <StatusPill tone="green">Connected</StatusPill>
            ) : (
              <StatusPill tone="amber">Reconnecting…</StatusPill>
            )}
          </span>
        </div>
        <div className="stream-mgr-panel__stat">
          <span className="stream-mgr-panel__stat-label">Bitrate</span>
          <span className="stream-mgr-panel__stat-value">
            {stats?.audioBitrateKbps != null ? `${stats.audioBitrateKbps} kbps` : '—'}
          </span>
        </div>
        <div className="stream-mgr-panel__stat">
          <span className="stream-mgr-panel__stat-label">Viewers</span>
          <span className="stream-mgr-panel__stat-value">{stats?.listeners ?? '—'}</span>
        </div>
      </div>

      <MultistreamStatus slug={slug} />

      <div className="stream-mgr-panel__chat">
        <ChatPanel slug={slug} announcements={[]} isLoggedIn accountHandle={displayName} />
      </div>
    </div>
  )
}
