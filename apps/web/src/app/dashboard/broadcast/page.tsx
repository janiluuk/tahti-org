// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import type { VisualPreset } from '@tahti/shared'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import type { ManageStats } from '../../c/[slug]/_manage-panel'
import { BroadcastStudio } from './_broadcast-studio'
import { fetchAutoRecordEnabled } from './recording-actions'
import { fetchAutoPublishBroadcast } from './publish-actions'

interface StreamSettings {
  rtmp: { server: string; streamKey: string; fallbackServers?: string[] }
  icecast: { server: string; mount: string; password: string; fallbackServers?: string[] }
  hlsUrl: string
}

interface StreamOverlay {
  streamOverlayTitle: string | null
  streamOverlaySubtitle: string | null
  streamOverlayCoverUrl: string | null
  streamOverlayBackdropUrl: string | null
  streamOverlayVisualPreset: VisualPreset
}

type BroadcastUsageInfo = {
  unlimited: boolean
  secondsUsed: number
  secondsRemaining: number | null
  warnings: number[]
  warningLevel?: 'none' | '45m' | '55m' | 'grace' | 'blocked'
  atCap: boolean
  inGrace?: boolean
  blocked?: boolean
  showUpgradeCta?: boolean
  weeklyCapSeconds: number
}

export default async function BroadcastStudioPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/broadcast')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/broadcast')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const authHeaders = { Cookie: `tahti_session=${sessionValue}` }
  const get = (path: string) =>
    fetch(`${apiUrl}${path}`, { headers: authHeaders, cache: 'no-store' as const })

  let streamSettings: StreamSettings | null = null
  let broadcastUsage: BroadcastUsageInfo | null = null
  let autoRecordEnabled = true
  let autoPublishBroadcast = true
  let manageStats: ManageStats | null = null
  let streamOverlay: StreamOverlay = {
    streamOverlayTitle: null,
    streamOverlaySubtitle: null,
    streamOverlayCoverUrl: null,
    streamOverlayBackdropUrl: null,
    streamOverlayVisualPreset: 'MINIMAL',
  }

  try {
    const [streamSettingsRes, broadcastUsageRes, overlayRes, statsRes, autoRecord, autoPublish] =
      await Promise.all([
        get('/api/me/stream-settings'),
        get('/api/me/broadcast-usage'),
        get('/api/me/channel/stream-overlay'),
        get(`/api/channels/${user.channel.slug}/manage-stats`),
        fetchAutoRecordEnabled(),
        fetchAutoPublishBroadcast(),
      ])

    if (streamSettingsRes.ok) streamSettings = (await streamSettingsRes.json()) as StreamSettings
    if (broadcastUsageRes.ok) {
      broadcastUsage = (await broadcastUsageRes.json()) as BroadcastUsageInfo
    }
    if (overlayRes.ok) streamOverlay = (await overlayRes.json()) as StreamOverlay
    if (statsRes.ok) manageStats = (await statsRes.json()) as ManageStats
    autoRecordEnabled = autoRecord
    autoPublishBroadcast = autoPublish
  } catch {
    // render with partial data
  }

  const isLive = Boolean(user.channel.goneLiveAt)

  return (
    <PageShell size="lg">
      <div className="broadcast-studio-page">
        <header className="studio-page-header broadcast-studio-page__header">
          <div>
            <h1 className="studio-page-title">Broadcast studio</h1>
            <Text tone="muted" size="sm">
              Connect your software, preview the stream, then share your channel when you are ready.
            </Text>
          </div>
          <div className="studio-page-header__actions">
            <StudioHeaderActions
              hasChannel
              isLive={isLive}
              channelSlug={user.channel.slug}
              showBack
            />
          </div>
        </header>

        {streamSettings ? (
          <BroadcastStudio
            channelSlug={user.channel.slug}
            artistUsername={user.username}
            // The fallback rotation reports LIVE at the channel level, but it
            // is not the artist's broadcast state shown by this studio.
            channelState={
              user.channel.goneLiveAt
                ? 'LIVE'
                : user.channel.state === 'PREVIEW'
                  ? 'PREVIEW'
                  : 'OFFLINE'
            }
            streamSettings={streamSettings}
            broadcastUsage={broadcastUsage}
            autoRecordEnabled={autoRecordEnabled}
            autoPublishBroadcast={autoPublishBroadcast}
            streamOverlay={streamOverlay}
            manageStats={manageStats}
          />
        ) : (
          <Text tone="muted">Could not load stream credentials. Refresh or contact support.</Text>
        )}
      </div>
    </PageShell>
  )
}
