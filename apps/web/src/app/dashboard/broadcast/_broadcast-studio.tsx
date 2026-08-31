'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BroadcastStatusBar, ButtonIcon, Panel, StatusPill, Text, Button } from '@tahti/ui'
import HlsPlayer from '@/app/c/[slug]/hls-player'
import { usePlayer } from '@/contexts/player-context'
import { resolveChannelUrl } from '@/lib/app-url'
import StreamSettingsPanel from '../stream-settings'
import BroadcastUsageBanner, { type BroadcastUsage } from '../broadcast-usage'
import { EndBroadcastBtn } from '../end-broadcast-btn'
import { GoLiveBtn } from '../go-live-btn'
import { Step3Preflight } from './_step3-preflight'
import { GreenRoomPanel } from './_green-room-panel'
import { Step4GoLive } from './_step4-go-live'
import { SignalMeters } from './_signal-meters'
import { RecordingToggle } from './_recording-toggle'
import { PublishToggle } from './_publish-toggle'
import { ChannelControlsPanel } from '../channel-controls-panel'
import { StreamOverlayPanel } from '../settings/multistream/stream-overlay-panel'
import { StreamStatsCard } from './_stream-stats-card'

interface StreamSettings {
  rtmp: { server: string; streamKey: string; fallbackServers?: string[] }
  icecast: { server: string; mount: string; password: string; fallbackServers?: string[] }
  hlsUrl: string
}

interface SignalStatus {
  connected: boolean
  codec: string | null
  bitrateKbps: number | null
  listeners: number | null
}

interface StreamOverlay {
  streamOverlayTitle: string | null
  streamOverlaySubtitle: string | null
  streamOverlayCoverUrl: string | null
}

type LiveStatus = 'offline' | 'preview' | 'live'

function statusFromState(state: string | undefined): LiveStatus {
  if (state === 'LIVE') return 'live'
  if (state === 'PREVIEW') return 'preview'
  return 'offline'
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

const WIZARD_STEPS = [
  { num: 1, label: 'Setup' },
  { num: 2, label: 'Pre-flight' },
  { num: 3, label: 'Go live' },
] as const

export function BroadcastStudio({
  channelSlug,
  artistUsername,
  channelState: initialState,
  streamSettings,
  broadcastUsage,
  autoRecordEnabled,
  autoPublishBroadcast,
  streamOverlay,
}: {
  channelSlug: string
  artistUsername: string
  channelState: string
  streamSettings: StreamSettings
  broadcastUsage: BroadcastUsage | null
  autoRecordEnabled: boolean
  autoPublishBroadcast: boolean
  streamOverlay: StreamOverlay
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { analyserL, analyserR, track, playing } = usePlayer()
  const initialStatus = statusFromState(initialState)
  const [status, setStatus] = useState<LiveStatus>(initialStatus)
  const [signal, setSignal] = useState<SignalStatus | null>(null)
  const [streamType, setStreamType] = useState<'rtmp' | 'icecast'>('rtmp')

  const requestedStep = Number(searchParams.get('step'))
  const activeStep = [1, 2, 3].includes(requestedStep)
    ? requestedStep
    : initialStatus === 'offline'
      ? 1
      : 3

  function setActiveStep(step: number) {
    router.push(`/dashboard/broadcast?step=${step}`)
  }

  useEffect(() => {
    setStatus(statusFromState(initialState))
  }, [initialState])

  useEffect(() => {
    if (status === 'live') return
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (!res.ok) return
        const me = (await res.json()) as {
          channel?: { state?: string; goneLiveAt?: string | null }
        }
        const next = me.channel?.goneLiveAt
          ? 'live'
          : statusFromState(me.channel?.state === 'LIVE' ? undefined : me.channel?.state)
        if (next !== status) {
          setStatus(next)
          router.refresh()
        }
      } catch {
        // ignore polling errors
      }
    }, 4000)
    return () => window.clearInterval(id)
  }, [status, activeStep, router])

  // Setup polls Icecast's status JSON for confirmation; Go live also polls so
  // its audio-check panel stays fresh.
  useEffect(() => {
    if (![1, 3].includes(activeStep) || status === 'live') return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/me/stream-settings/status`, {
          credentials: 'include',
        })
        if (res.ok && !cancelled) setSignal((await res.json()) as SignalStatus)
      } catch {
        // ignore polling errors
      }
    }
    poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [activeStep, status])

  const isLive = status === 'live'
  const isPreview = status === 'preview'
  const signalConfirmed = isLive || isPreview || Boolean(signal?.connected)
  const maxUnlockedStep = status === 'offline' ? (signalConfirmed ? 2 : 1) : 3

  function goToStep(step: number) {
    if (step <= maxUnlockedStep) setActiveStep(step)
  }

  return (
    <div className="broadcast-studio">
      <div data-hero>
        {isLive ? (
          <BroadcastStatusBar
            state="live"
            meta={
              <Link href={resolveChannelUrl(channelSlug)} className="db-overview-broadcast-link">
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
            offlineMessage="Offline — work through the steps below, then start streaming in OBS or Mixxx."
          />
        )}
      </div>

      <BroadcastUsageBanner usage={broadcastUsage} />

      <nav className="broadcast-wizard" aria-label="Broadcasting setup steps">
        <ol className="broadcast-wizard__list">
          {WIZARD_STEPS.map((step, index) => {
            const unlocked = step.num <= maxUnlockedStep
            const active = step.num === activeStep
            const stepLabel = `${step.num} · ${step.label.toUpperCase()}`
            return (
              <li key={step.num} className="broadcast-wizard__step">
                {index > 0 && <span className="broadcast-wizard__arrow">→</span>}
                {active ? (
                  <StatusPill tone="cyan">{stepLabel}</StatusPill>
                ) : unlocked ? (
                  <button
                    type="button"
                    className="broadcast-wizard__link"
                    onClick={() => goToStep(step.num)}
                  >
                    {stepLabel}
                  </button>
                ) : (
                  <span className="broadcast-wizard__link broadcast-wizard__link--locked">
                    {stepLabel}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {activeStep === 1 && (
        <>
          <StreamSettingsPanel
            initial={streamSettings}
            isLive={isLive || isPreview}
            defaultCollapsed
            onStreamTypeChange={setStreamType}
          />
          <Panel
            title="Test your signal"
            headerTight
            description="Start your selected broadcasting software and confirm the signal here."
          >
            <div data-hero>
              <HlsPlayer
                url={streamSettings.hlsUrl}
                title="Studio preview"
                waitingForSignal={!signal?.connected}
              />
            </div>
            {signal?.connected ? (
              <>
                <p className="studio-notice studio-notice--success">
                  ✓ Signal received — {signal.codec ?? 'unknown codec'} · original quality
                </p>
                <SignalMeters
                  analyserL={analyserL}
                  analyserR={analyserR}
                  active={track?.id === streamSettings.hlsUrl && playing}
                />
                {!(track?.id === streamSettings.hlsUrl && playing) && (
                  <Text as="p" tone="muted" size="sm" className="broadcast-studio__preview-hint">
                    Press play on the preview above to see input levels.
                  </Text>
                )}
              </>
            ) : (
              <Text as="p" tone="muted" size="sm" className="broadcast-studio__preview-hint">
                Waiting for signal from{' '}
                {streamType === 'rtmp' ? 'OBS / Streamlabs' : 'Mixxx / Traktor / butt'}.
              </Text>
            )}
            <div className="studio-actions">
              <Button
                disabled={!signalConfirmed}
                onClick={() => setActiveStep(2)}
                variant="primary"
              >
                <ButtonIcon name="arrowRight" />
                Continue to pre-flight
              </Button>
            </div>
          </Panel>
        </>
      )}

      {activeStep === 2 && (
        <Panel
          title="Pre-flight"
          headerTight
          description={
            signal?.connected
              ? `Listen to your own stream at full quality (${signal.codec ?? 'unknown codec'} · original quality), then double-check distribution before you go live.`
              : 'Listen to your own stream at full quality, then double-check distribution before you go live.'
          }
        >
          <div data-hero>
            <HlsPlayer url={streamSettings.hlsUrl} title="Studio preview (full quality)" />
          </div>
          <Step3Preflight />
          {!isLive && (
            <div className="broadcast-studio__toggles">
              <RecordingToggle initialEnabled={autoRecordEnabled} />
              <PublishToggle initialEnabled={autoPublishBroadcast} />
            </div>
          )}
          <details className="broadcast-studio__preflight-more studio-mt-md">
            <summary>Green room</summary>
            <GreenRoomPanel artistUsername={artistUsername} />
          </details>
          <div className="studio-actions">
            <Button onClick={() => setActiveStep(1)} variant="ghost">
              ← Back to setup
            </Button>
            <Button onClick={() => setActiveStep(3)} variant="primary">
              <ButtonIcon name="arrowRight" />
              Continue to go live
            </Button>
          </div>
        </Panel>
      )}

      {activeStep === 3 && (
        <Panel title="Go live" headerTight>
          {isLive ? (
            <Text as="p" tone="muted" size="sm">
              Manage your stream from the stream manager icon in the top bar.
            </Text>
          ) : isPreview ? (
            <Step4GoLive signal={signal} hlsUrl={streamSettings.hlsUrl} />
          ) : (
            <Text as="p" tone="muted" size="sm">
              Start streaming in step 1 to unlock going live.
            </Text>
          )}
        </Panel>
      )}

      <section className="broadcast-studio__control-room" aria-labelledby="control-room-title">
        <div className="broadcast-studio__section-heading">
          <div>
            <h2 id="control-room-title" className="studio-section-title">
              Control room
            </h2>
            <p className="studio-text-muted-sm">
              Keep your rotation, live health, and mirror artwork organized in one place.
            </p>
          </div>
        </div>
        <div className="broadcast-studio__control-grid">
          <ChannelControlsPanel
            slug={channelSlug}
            title="Active rotation"
            description="Control what plays when you are not broadcasting live."
            defaultCollapsed
          />
          <StreamStatsCard slug={channelSlug} />
          <StreamOverlayPanel initial={streamOverlay} />
        </div>
      </section>
    </div>
  )
}
