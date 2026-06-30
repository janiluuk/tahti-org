'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { goLive } from '../actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface Preflight {
  title: string | null
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
}

interface RtmpTarget {
  id: string
  label: string
  enabled: boolean
}

export function Step4GoLive() {
  const router = useRouter()
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [targets, setTargets] = useState<RtmpTarget[]>([])
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        router.refresh()
      } else {
        alert(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  const activeTargets = targets.filter((t) => t.enabled)

  return (
    <div className="broadcast-studio__go-live-hero">
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
            <dt>Audio quality</dt>
            <dd className="broadcast-studio__summary-accent">FLAC 96 kHz / 24-bit</dd>
          </div>
          <div>
            <dt>Visibility</dt>
            <dd>{preflight?.visibility === 'FAN_ONLY' ? 'Fan-subscribers only' : 'Public'}</dd>
          </div>
          <div>
            <dt>Simulcast to</dt>
            <dd>{activeTargets.length ? activeTargets.map((t) => t.label).join(' + ') : 'None'}</dd>
          </div>
          <div>
            <dt>Auto-archive</dt>
            <dd className={preflight?.autoArchive ? 'broadcast-studio__summary-accent' : undefined}>
              {(preflight?.autoArchive ?? true)
                ? 'enabled (you can edit later)'
                : 'off — saved as a draft to publish manually'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
