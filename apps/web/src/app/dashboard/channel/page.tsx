// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { ChannelEditorSections } from './_channel-editor-sections'
import { fetchChannelEditorData } from './_channel-editor-data'

export default async function ChannelDesignPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/channel')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/channel')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
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
  } = await fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug)

  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">Channel design</h1>
          <Text tone="muted" size="sm">
            Customize how your public channel looks — gallery, headline text, and visual style.
          </Text>
        </div>
        <div className="studio-page-header__actions">
          <NextLink
            href="/dashboard/channel/gallery"
            className="ui-btn ui-btn--sm ui-btn--secondary"
          >
            Gallery &amp; backdrop →
          </NextLink>
          <NextLink href="/dashboard/channel/text" className="ui-btn ui-btn--sm ui-btn--secondary">
            Text overlay →
          </NextLink>
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
      />
    </PageShell>
  )
}
