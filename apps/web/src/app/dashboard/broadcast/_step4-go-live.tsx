'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@tahti/ui'
import { usePlayer } from '@/contexts/player-context'
import { goLive } from '../actions'
import { ChannelControlsPanel } from '../channel-controls-panel'
import { SignalMeters } from './_signal-meters'

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

export function Step4GoLive({
  signal,
  hlsUrl,
  slug,
}: {
  signal: SignalStatus | null
  hlsUrl: string
  slug: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <ChannelControlsPanel
          slug={slug}
          title="Active rotation"
          description="Preview and manage what plays until you go live."
        />
      </div>
    </>
  )
}
