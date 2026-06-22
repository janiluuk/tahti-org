// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { fetchMixcloudStatus } from '../mixcloud-actions'
import type { ModeratorRow } from '../moderator-actions'
import type { ProgrammeItemRow } from '../programme-actions'
import { BroadcastStudio } from './_broadcast-studio'
import { BroadcastSettingsSections, ChannelDesignLinkPanel } from './_broadcast-settings-sections'

interface StreamSettings {
  rtmp: { server: string; streamKey: string; fallbackServers?: string[] }
  icecast: { server: string; mount: string; password: string; fallbackServers?: string[] }
  hlsUrl: string
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
  let announcements: Array<{ id: string; body: string; createdAt: string }> = []
  let moderators: ModeratorRow[] = []
  let channelProgramme: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] } | null =
    null
  let channelSchedule: { nextBroadcastAt: string | null; nextBroadcastNote: string | null } = {
    nextBroadcastAt: null,
    nextBroadcastNote: null,
  }

  try {
    const [
      streamSettingsRes,
      broadcastUsageRes,
      announcementsRes,
      moderatorsRes,
      programmeRes,
      scheduleRes,
    ] = await Promise.all([
      get('/api/me/stream-settings'),
      get('/api/me/broadcast-usage'),
      fetch(`${apiUrl}/api/chat/${user.channel.slug}/announcements`, {
        headers: authHeaders,
        cache: 'no-store',
      }),
      get('/api/me/channel/moderators'),
      get('/api/me/channel/programme'),
      get('/api/me/channel/schedule'),
    ])

    if (streamSettingsRes.ok) streamSettings = (await streamSettingsRes.json()) as StreamSettings
    if (broadcastUsageRes.ok) {
      broadcastUsage = (await broadcastUsageRes.json()) as BroadcastUsageInfo
    }
    if (announcementsRes.ok) {
      announcements = (await announcementsRes.json()) as typeof announcements
    }
    if (moderatorsRes.ok) moderators = (await moderatorsRes.json()) as ModeratorRow[]
    if (programmeRes.ok) channelProgramme = (await programmeRes.json()) as typeof channelProgramme
    if (scheduleRes.ok) channelSchedule = (await scheduleRes.json()) as typeof channelSchedule
  } catch {
    // render with partial data
  }

  if (!channelProgramme) channelProgramme = { fallbackMode: 'shuffle', items: [] }

  const mixcloudStatus = await fetchMixcloudStatus()
  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="md">
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
            channelState={user.channel.state}
            streamSettings={streamSettings}
            broadcastUsage={broadcastUsage}
          />
        ) : (
          <Text tone="muted">Could not load stream credentials. Refresh or contact support.</Text>
        )}

        <div className="broadcast-studio-page__manage">
          <h2 className="studio-text-strong-sm studio-mb-md">Channel &amp; distribution</h2>
          <ChannelDesignLinkPanel />
          <BroadcastSettingsSections
            channelSlug={user.channel.slug}
            isLive={isLive}
            announcements={announcements}
            moderators={moderators}
            channelProgramme={channelProgramme}
            channelSchedule={channelSchedule}
            mixcloudStatus={mixcloudStatus}
            apiUrl={apiUrl}
          />
        </div>
      </div>
    </PageShell>
  )
}
