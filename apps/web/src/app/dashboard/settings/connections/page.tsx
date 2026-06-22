// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SocialPromoPanel from '../../social-promo-panel'
import { ImportConnectionsPanel } from '../../_import-connections-panel'
import type { SocialSettings } from '../../social-actions'

interface ImportConnectStatus {
  connected: boolean
  configured: boolean
}

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

export default async function ConnectionsSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [socialSettings, googleDriveImport, bandcampImport, soundcloudImport] = await Promise.all([
    apiFetch<SocialSettings>(apiUrl, cookie, '/api/me/social'),
    apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/google-drive'),
    apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/bandcamp'),
    apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/soundcloud'),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Connections</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Social links and cloud accounts connected to your profile.
          </p>
        </div>
      </div>

      {socialSettings && <SocialPromoPanel initial={socialSettings} apiUrl={apiUrl} />}

      <ImportConnectionsPanel
        connections={[
          {
            id: 'google-drive',
            label: 'Google Drive',
            connected: googleDriveImport?.connected ?? false,
            configured: googleDriveImport?.configured ?? false,
            importHref: '/dashboard/upload/import/google-drive',
            disconnectPath: '/api/me/google-drive',
          },
          {
            id: 'bandcamp',
            label: 'Bandcamp',
            connected: bandcampImport?.connected ?? false,
            configured: bandcampImport?.configured ?? false,
            importHref: '/dashboard/upload/import/bandcamp',
            disconnectPath: '/api/me/bandcamp',
          },
          {
            id: 'soundcloud',
            label: 'SoundCloud',
            connected: soundcloudImport?.connected ?? false,
            configured: soundcloudImport?.configured ?? false,
            importHref: '/dashboard/upload/import/soundcloud',
            disconnectPath: '/api/me/soundcloud',
          },
        ]}
      />
    </div>
  )
}
