// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import type { ArtistKind, PressKitImageItem } from '@tahti/shared'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchChannelEditorData } from '../../channel/_channel-editor-data'
import { ArtistInfoForm } from './_artist-info-form'
import { fetchMyMembers } from '../members/actions'

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

export default async function ArtistInfoSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/artist-info')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/artist-info')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [
    {
      avatarUrl,
      avatarPosterUrl,
      avatarTheme,
      logoUrl,
      logoPlacement,
      bio,
      countryCode,
      pronouns,
      defaultLocation,
      genres,
      links,
      streamingLinks,
    },
    members,
    artistKind,
    pressKitImages,
    gallerySettings,
  ] = await Promise.all([
    fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug),
    fetchMyMembers(),
    fetchArtistKind(apiUrl, sessionValue),
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

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Artist info</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Shape the essentials listeners see on your artist page. Links live under{' '}
            <a href="/dashboard/settings/connections" className="studio-link">
              Connections
            </a>
            ; colors and layout under{' '}
            <a href="/dashboard/channel/edit" className="studio-link">
              Channel design
            </a>
            .
          </p>
        </div>
      </div>

      <ArtistInfoForm
        initial={{
          displayName: user.displayName,
          avatarUrl,
          avatarPosterUrl,
          avatarTheme,
          logoUrl,
          logoPlacement,
          countryCode,
          pronouns,
          defaultLocation,
          genres,
          bio,
          links,
          streamingLinks,
          artistKind,
          pressKit: {
            images: pressKitImages ?? [],
            galleryPublic: gallerySettings?.pressKitGalleryPublic ?? false,
            username: user.username,
            apiUrl,
          },
        }}
        initialMembers={members}
      />
    </div>
  )
}

async function fetchArtistKind(apiUrl: string, sessionValue: string): Promise<ArtistKind> {
  try {
    const res = await fetch(`${apiUrl}/api/me/profile`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (!res.ok) return 'SINGLE'
    const data = (await res.json()) as { artistKind?: ArtistKind }
    return data.artistKind === 'COLLECTIVE' ? 'COLLECTIVE' : 'SINGLE'
  } catch {
    return 'SINGLE'
  }
}
