'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@tahti/ui'
import { usePlayer } from '@/contexts/player-context'
import { goLive } from '../actions'
import { SignalMeters } from './_signal-meters'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface SignalStatus {
  connected: boolean
  codec: string | null
  bitrateKbps: number | null
  listeners: number | null
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v4m-4 0h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Audio-readiness card for the go-live step: shows whether a signal is
 * flowing before the artist opens the channel, and — once they check it —
 * live L/R levels so they know exactly when to start reacting. */
function AudioCheckPanel({ signal, hlsUrl }: { signal: SignalStatus | null; hlsUrl: string }) {
  const { track, playing, analyserL, analyserR, load, togglePlay } = usePlayer()
  const connected = Boolean(signal?.connected)
  const isPreviewTrack = track?.id === hlsUrl
  const checking = isPreviewTrack && playing

  async function checkAudio() {
    if (!isPreviewTrack) {
      load({ id: hlsUrl, kind: 'live', url: hlsUrl, title: 'Studio preview' }, { autoplay: true })
      return
    }
    await togglePlay()
  }

  const state: 'waiting' | 'ready' | 'checking' = checking
    ? 'checking'
    : connected
      ? 'ready'
      : 'waiting'

  return (
    <div className={`broadcast-studio__audio-check broadcast-studio__audio-check--${state}`}>
      <div className="broadcast-studio__audio-check-header">
        <span className="broadcast-studio__audio-check-icon" aria-hidden>
          <MicIcon />
          <span className="broadcast-studio__pulse-dot" />
        </span>
        <div>
          <p className="broadcast-studio__audio-check-status">
            {state === 'waiting'
              ? 'Waiting for your audio…'
              : state === 'checking'
                ? 'Listening — that’s really you!'
                : 'You’re connected!'}
          </p>
          <p className="broadcast-studio__audio-check-hint">
            {state === 'waiting'
              ? 'Start streaming in OBS, Mixxx, or Traktor — we’ll pick it up automatically.'
              : state === 'checking'
                ? 'Talk or play something — watch the bars move below.'
                : 'Tap the button to hear yourself and check your levels before you go live.'}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            className="broadcast-studio__audio-check-btn"
            onClick={() => void checkAudio()}
          >
            {checking ? '⏸ Stop listening' : '▶ Check my audio'}
          </button>
        )}
      </div>
      {checking && <SignalMeters analyserL={analyserL} analyserR={analyserR} active={checking} />}
    </div>
  )
}

interface Preflight {
  title: string | null
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
  showType: 'LIVE_SET' | 'TALK'
  episodeNumber: number | null
  tagline: string | null
  plannedRadioShow: {
    bookingId: string
    episodeNumber: number
    tagline: string | null
    showType: 'LIVE_SET' | 'TALK'
  } | null
}

interface RtmpTarget {
  id: string
  label: string
  enabled: boolean
}

export function Step4GoLive({ signal, hlsUrl }: { signal: SignalStatus | null; hlsUrl: string }) {
  const router = useRouter()
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [targets, setTargets] = useState<RtmpTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [preflightRes, targetsRes] = await Promise.all([
          fetch(`${API_BASE}/api/me/channel/preflight`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/me/rtmp-targets`, { credentials: 'include' }),
        ])
        if (!cancelled && preflightRes.ok) setPreflight((await preflightRes.json()) as Preflight)
        if (!cancelled && targetsRes.ok) setTargets((await targetsRes.json()) as RtmpTarget[])
      } catch {
        // render with defaults
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleGoLive() {
    setError(null)
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  const activeTargets = targets.filter((t) => t.enabled)

  return (
    <>
      <AudioCheckPanel signal={signal} hlsUrl={hlsUrl} />
      {error && <Alert variant="error">{error}</Alert>}
      <div className="broadcast-studio__go-live-hero" data-hero>
        <h3 className="broadcast-studio__go-live-title">Ready when you are</h3>
        <p className="broadcast-studio__go-live-sub">
          Pressing this opens your channel to listeners. Your stream is healthy, audio sounds right,
          and the broadcast metadata is set.
        </p>
        <button
          type="button"
          className="broadcast-studio__go-live-btn"
          onClick={() => void handleGoLive()}
          disabled={loading}
        >
          <span className="dot-live" aria-hidden />
          {loading ? 'Going live…' : 'GO LIVE NOW'}
        </button>
        <p className="broadcast-studio__go-live-hint">
          ⌨ hold space-bar to use a 3-2-1 countdown instead
        </p>
        <div className="broadcast-studio__summary-card">
          <span className="broadcast-studio__summary-label">Broadcast summary</span>
          <dl className="broadcast-studio__summary-list">
            <div>
              <dt>Show name</dt>
              <dd>{preflight?.title || 'Untitled broadcast'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd className="broadcast-studio__summary-accent">
                {(preflight?.showType ?? preflight?.plannedRadioShow?.showType) === 'TALK'
                  ? 'Talk'
                  : 'Live set'}
              </dd>
            </div>
            {(preflight?.episodeNumber ?? preflight?.plannedRadioShow?.episodeNumber) != null ? (
              <div>
                <dt>Episode</dt>
                <dd className="broadcast-studio__summary-accent">
                  #{preflight?.episodeNumber ?? preflight?.plannedRadioShow?.episodeNumber}
                  {(preflight?.tagline ?? preflight?.plannedRadioShow?.tagline)
                    ? ` — ${preflight?.tagline ?? preflight?.plannedRadioShow?.tagline}`
                    : ''}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Audio quality</dt>
              <dd className="broadcast-studio__summary-accent">FLAC 96 kHz / 24-bit</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{preflight?.visibility === 'FAN_ONLY' ? 'Fan-subscribers only' : 'Public'}</dd>
            </div>
            <div>
              <dt>Simulcast to</dt>
              <dd>
                {activeTargets.length ? activeTargets.map((t) => t.label).join(' + ') : 'None'}
              </dd>
            </div>
            <div>
              <dt>Auto-archive</dt>
              <dd
                className={preflight?.autoArchive ? 'broadcast-studio__summary-accent' : undefined}
              >
                {(preflight?.autoArchive ?? true)
                  ? 'enabled (you can edit later)'
                  : 'off — saved as a draft to publish manually'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  )
}
