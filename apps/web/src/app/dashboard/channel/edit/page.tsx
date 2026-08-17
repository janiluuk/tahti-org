// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import { ChannelEditorSections } from '../_channel-editor-sections'
import { fetchChannelEditorData } from '../_channel-editor-data'
import type { PressKitImageItem } from '@tahti/shared'

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

export default async function ChannelDesignPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/channel/edit')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/channel/edit')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [editorData, pressKitImages, gallerySettings] = await Promise.all([
    fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug),
    apiFetch<PressKitImageItem[]>(
      apiUrl,
      `tahti_session=${sessionValue}`,
      '/api/me/press-kit/images',
    ),
    apiFetch<{ pressKitGalleryPublic: boolean }>(
      apiUrl,
      `tahti_session=${sessionValue}`,
      '/api/me/press-kit/gallery-settings',
    ),
  ])
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
  } = editorData

  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">Channel design</h1>
          <Text tone="muted" size="sm">
            Design your channel, background media, visualizer, and press kit in one place.
          </Text>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel
            isLive={isLive}
            channelSlug={user.channel.slug}
            showBack
            backHref="/dashboard"
            backLabel="Dashboard"
          />
        </div>
      </header>

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
        channelGallery={channelGallery}
        channelTextLayer={channelTextLayer}
        channelVisual={channelVisual}
        pressKit={{
          images: pressKitImages ?? [],
          galleryPublic: gallerySettings?.pressKitGalleryPublic ?? false,
          username: user.username,
          apiUrl,
        }}
      />
    </PageShell>
  )
}
