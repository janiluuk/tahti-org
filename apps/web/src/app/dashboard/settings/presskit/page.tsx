// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import type { PressKitImageItem } from '@tahti/shared'
import { PressKitBuilder } from './_press-kit-builder'

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

export default async function PressKitSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, profile, pressKitImages, gallerySettings] = await Promise.all([
    getDashboardUser(),
    apiFetch<{ bio: string | null }>(apiUrl, cookie, '/api/me/profile'),
    apiFetch<PressKitImageItem[]>(apiUrl, cookie, '/api/me/press-kit/images'),
    apiFetch<{ pressKitGalleryPublic: boolean }>(
      apiUrl,
      cookie,
      '/api/me/press-kit/gallery-settings',
    ),
  ])
  if (!user) redirect('/login')

  if (!user.channel) {
    return (
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Press kit</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Set up a channel first to build a press kit.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Press kit</h1>
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
    </>
  )
}
