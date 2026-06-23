// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { ChannelEditorSections } from './_channel-editor-sections'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

export default async function ChannelDesignPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/channel')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/channel')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const authHeaders = { Cookie: `tahti_session=${sessionValue}` }
  const get = (path: string) =>
    fetch(`${apiUrl}${path}`, { headers: authHeaders, cache: 'no-store' as const })

  let channelGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  } | null = null
  let channelTextLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  } | null = null
  let channelVisual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  } | null = null

  let avatarUrl: string | null = null
  let bio = ''
  let countryCode: string | null = null
  let pronouns: string | null = null
  let genres: string[] = []
  let links: Array<{ label: string; url: string }> = []

  try {
    const [galleryRes, textLayerRes, visualRes, channelRes] = await Promise.all([
      get('/api/me/channel/gallery'),
      get('/api/me/channel/text-layer'),
      get('/api/me/channel/visual'),
      fetch(`${apiUrl}/api/channels/${user.channel.slug}`, { cache: 'no-store' }),
    ])
    if (galleryRes.ok) channelGallery = (await galleryRes.json()) as typeof channelGallery
    if (textLayerRes.ok) channelTextLayer = (await textLayerRes.json()) as typeof channelTextLayer
    if (visualRes.ok) channelVisual = (await visualRes.json()) as typeof channelVisual
    if (channelRes.ok) {
      const channelData = (await channelRes.json()) as {
        user: {
          avatarUrl: string | null
          bio: string | null
          countryCode: string | null
          pronouns: string | null
          socialLinks: Record<string, string> | null
        }
      }
      avatarUrl = channelData.user.avatarUrl
      bio = channelData.user.bio ?? ''
      countryCode = channelData.user.countryCode
      pronouns = channelData.user.pronouns
      const socialLinks = channelData.user.socialLinks ?? {}
      genres = socialLinks.genres
        ? socialLinks.genres
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean)
        : []
      links = Object.entries(socialLinks)
        .filter(([key, url]) => key !== 'genres' && url)
        .map(([label, url]) => ({ label, url }))
    }
  } catch {
    // render with defaults
  }

  if (!channelGallery) channelGallery = { galleryMode: 'NONE', slideshowImages: [] }
  if (!channelTextLayer) {
    channelTextLayer = { textLayerMode: 'NONE', textLayerText: '', textLayerAlign: 'CENTER' }
  }
  if (!channelVisual) {
    channelVisual = {
      visualPreset: 'MINIMAL',
      colorSchemeJson: null,
      slideshowPreset: 'FADE',
      slideshowIntervalSeconds: 8,
      slideshowTransitionMs: 600,
      slideshowAutoplay: true,
    }
  }

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
