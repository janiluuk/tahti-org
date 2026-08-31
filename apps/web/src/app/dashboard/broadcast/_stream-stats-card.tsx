// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Panel, StatusPill, Text } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface StreamStats {
  audioBitrateKbps: number | null
  signalConnected: boolean
  listeners: number
}

export function StreamStatsCard({ slug }: { slug: string }) {
  const [stats, setStats] = useState<StreamStats | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const response = await fetch(`${API_BASE}/api/channels/${slug}/manage-stats`, {
          credentials: 'include',
        })
        if (response.ok && !cancelled) setStats((await response.json()) as StreamStats)
      } catch {
        // Keep the last known values; a transient poll failure is not a stream failure.
      }
    }
    void poll()
    const timer = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [slug])

  return (
    <Panel
      title="Stream stats"
      headerTight
      description="Live output health and audience signals, refreshed automatically."
    >
      <div className="go-live-stats" role="group" aria-label="Stream statistics">
        <div className="go-live-stats__item">
          <span className="go-live-stats__label">Signal</span>
          {stats == null ? (
            <span className="go-live-stats__value">—</span>
          ) : (
            <StatusPill tone={stats.signalConnected ? 'green' : 'amber'}>
              {stats.signalConnected ? 'Connected' : 'Unavailable'}
            </StatusPill>
          )}
        </div>
        <div className="go-live-stats__item">
          <span className="go-live-stats__label">Bitrate</span>
          <span className="go-live-stats__value">
            {stats?.audioBitrateKbps != null ? `${stats.audioBitrateKbps} kbps` : '—'}
          </span>
        </div>
        <div className="go-live-stats__item">
          <span className="go-live-stats__label">Listeners</span>
          <span className="go-live-stats__value">{stats?.listeners ?? '—'}</span>
        </div>
      </div>
      <Text as="p" size="sm" tone="muted" className="studio-m-0 studio-mt-md">
        Stats appear once your encoder or 24/7 rotation is producing audio.
      </Text>
    </Panel>
  )
}
