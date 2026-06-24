// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { BroadcastStudio } from './_broadcast-studio'

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

  try {
    const [streamSettingsRes, broadcastUsageRes] = await Promise.all([
      get('/api/me/stream-settings'),
      get('/api/me/broadcast-usage'),
    ])

    if (streamSettingsRes.ok) streamSettings = (await streamSettingsRes.json()) as StreamSettings
    if (broadcastUsageRes.ok) {
      broadcastUsage = (await broadcastUsageRes.json()) as BroadcastUsageInfo
    }
  } catch {
    // render with partial data
  }

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
      </div>
    </PageShell>
  )
}
