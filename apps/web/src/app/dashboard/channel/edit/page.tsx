// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { ChannelEditorSections } from '../_channel-editor-sections'
import { fetchChannelEditorData } from '../_channel-editor-data'

export default async function ChannelDesignPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/channel/edit')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/channel/edit')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const editorData = await fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug)
  const {
    channelGallery,
    channelTextLayer,
    channelVisual,
    avatarUrl,
    bio,
    countryCode,
    pronouns,
    genres,
    links,
    streamingLinks,
    showJoinDate,
    showDailyListeners,
  } = editorData

  const isLive = Boolean(user.channel.goneLiveAt)

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <ChannelEditorSections
        channelSlug={user.channel.slug}
        tier={user.tier}
        displayName={user.displayName}
        avatarUrl={avatarUrl}
        countryCode={countryCode}
        pronouns={pronouns}
        bio={bio}
        genres={genres}
        links={links}
        streamingLinks={streamingLinks}
        channelGallery={channelGallery}
        channelTextLayer={channelTextLayer}
        channelVisual={channelVisual}
        isLive={isLive}
        showJoinDate={showJoinDate}
        showDailyListeners={showDailyListeners}
      />
    </PageShell>
  )
}
