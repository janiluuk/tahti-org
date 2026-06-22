'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BroadcastStatusBar, Panel, Text } from '@tahti/ui'
import HlsPlayer from '@/app/c/[slug]/hls-player'
import StreamSettingsPanel from '../stream-settings'
import BroadcastUsageBanner, { type BroadcastUsage } from '../broadcast-usage'
import { EndBroadcastBtn } from '../end-broadcast-btn'
import { GoLiveBtn } from '../go-live-btn'

interface StreamSettings {
  rtmp: { server: string; streamKey: string; fallbackServers?: string[] }
  icecast: { server: string; mount: string; password: string; fallbackServers?: string[] }
  hlsUrl: string
}

type LiveStatus = 'offline' | 'preview' | 'live'

function statusFromState(state: string | undefined): LiveStatus {
  if (state === 'LIVE') return 'live'
  if (state === 'PREVIEW') return 'preview'
  return 'offline'
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export function BroadcastStudio({
  channelSlug,
  channelState: initialState,
  streamSettings,
  broadcastUsage,
}: {
  channelSlug: string
  channelState: string
  streamSettings: StreamSettings
  broadcastUsage: BroadcastUsage | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<LiveStatus>(statusFromState(initialState))

  useEffect(() => {
    setStatus(statusFromState(initialState))
  }, [initialState])

  useEffect(() => {
    if (status === 'live') return
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (!res.ok) return
        const me = (await res.json()) as { channel?: { state?: string } }
        const next = statusFromState(me.channel?.state)
        if (next !== status) {
          setStatus(next)
          router.refresh()
        }
      } catch {
        // ignore polling errors
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [status, router])

  const isLive = status === 'live'
  const isPreview = status === 'preview'

  return (
    <div className="broadcast-studio">
      {isLive ? (
        <BroadcastStatusBar
          state="live"
          meta={
            <Link href={`/c/${channelSlug}`} className="db-overview-broadcast-link">
              View public channel →
            </Link>
          }
          action={<EndBroadcastBtn mode="live" />}
        />
      ) : isPreview ? (
        <BroadcastStatusBar
          state="preview"
          meta="Listeners can't hear this yet — only you, in the preview player below."
          action={
            <div className="broadcast-studio__preview-actions">
              <GoLiveBtn />
              <EndBroadcastBtn mode="preview" />
            </div>
          }
        />
      ) : (
        <BroadcastStatusBar
          state="offline"
          offlineMessage="Offline — paste credentials below, then start streaming in OBS or Mixxx to enter preview."
        />
      )}

      <BroadcastUsageBanner usage={broadcastUsage} />

      <Panel
        title="Preview your stream"
        headerTight
        description={
          isLive
            ? 'You are on air — this is exactly what listeners hear.'
            : "Listen to your ingest here first. It's private until you click Go live."
        }
      >
        <HlsPlayer url={streamSettings.hlsUrl} title="Studio preview" />
        <Text as="p" tone="muted" size="sm" className="broadcast-studio__preview-hint">
          {isLive
            ? 'You are on air. Open your public channel when you are ready for listeners.'
            : isPreview
              ? 'Audio is flowing and only you can hear it. Click Go live above when you are ready for listeners.'
              : 'Start streaming with the credentials below — the preview updates automatically when ingest connects.'}
        </Text>
        <Link href={`/c/${channelSlug}`} className="broadcast-studio__public-link studio-link">
          Open public channel →
        </Link>
      </Panel>

      <StreamSettingsPanel initial={streamSettings} isLive={isLive || isPreview} />

      <Panel title="Go live checklist" headerTight>
        <ol className="broadcast-studio__steps">
          <li>Copy RTMP or Icecast credentials into OBS, Streamlabs, Mixxx, or Traktor.</li>
          <li>Click Start Streaming in your software.</li>
          <li>Confirm audio in the preview player above.</li>
          <li>
            Share your channel:{' '}
            <Link href={`/c/${channelSlug}`} className="studio-link">
              tahti.live/c/{channelSlug}
            </Link>
          </li>
        </ol>
        <Text as="p" tone="muted" size="sm" className="broadcast-studio__steps-foot">
          <Link href="/help/broadcast">Broadcast setup guides</Link>
          {' · '}
          <Link href="/help/multistream">Multistream to YouTube / Twitch</Link>
        </Text>
      </Panel>
    </div>
  )
}
