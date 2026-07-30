// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import type { PressKitImageItem } from '@tahti/shared'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchChannelEditorData } from '../../channel/_channel-editor-data'
import { ChannelGallerySections } from '../../channel/gallery/_channel-gallery-sections'
import { PressKitBuilder } from '../presskit/_press-kit-builder'

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function MediaPressKitSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/media')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/media')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionValue}`

  const [editorData, profile, pressKitImages, gallerySettings] = await Promise.all([
    fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug),
    apiFetch<{ bio: string | null }>(apiUrl, cookie, '/api/me/profile'),
    apiFetch<PressKitImageItem[]>(apiUrl, cookie, '/api/me/press-kit/images'),
    apiFetch<{ pressKitGalleryPublic: boolean }>(
      apiUrl,
      cookie,
      '/api/me/press-kit/gallery-settings',
    ),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Media &amp; Presskit</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Channel gallery &amp; backdrop, plus press photos promoters can download.
          </p>
        </div>
      </div>

      <div id="gallery" className="studio-channel-editor-page">
        <ChannelGallerySections
          channelSlug={user.channel.slug}
          displayName={user.displayName}
          {...editorData}
        />
      </div>

      <div id="presskit">
        <div className="studio-page-header studio-mt-lg">
          <div>
            <h2 className="studio-page-title">Press kit</h2>
            <p className="studio-text-muted-sm studio-mt-xs">
              Everything a promoter or venue needs — bio, photos, and a one-click download.
            </p>
          </div>
        </div>
        <PressKitBuilder
          initialImages={pressKitImages ?? []}
          initialGalleryPublic={gallerySettings?.pressKitGalleryPublic ?? false}
          username={user.username}
          displayName={user.displayName}
          bio={profile?.bio ?? null}
          apiUrl={apiUrl}
        />
      </div>
    </div>
  )
}
