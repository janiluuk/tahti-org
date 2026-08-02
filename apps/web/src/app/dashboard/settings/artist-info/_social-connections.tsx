// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import SocialPromoPanel from '../../social-promo-panel'
import { ImportConnectionsPanel } from '../../_import-connections-panel'
import type { SocialSettings } from '../../social-actions'
import { fetchMixcloudStatus } from '../../mixcloud-actions'
import { MixcloudConnect } from '../../mixcloud-connect'

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

/** OAuth / import accounts — lives on Settings → Connections. */
export async function SocialConnectionsSection({
  apiUrl,
  sessionValue,
}: {
  apiUrl: string
  sessionValue: string
}) {
  const cookie = `tahti_session=${sessionValue}`
  const [socialSettings, googleDriveImport, bandcampImport, soundcloudImport, mixcloudStatus] =
    await Promise.all([
      apiFetch<SocialSettings>(apiUrl, cookie, '/api/me/social'),
      apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/google-drive'),
      apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/bandcamp'),
      apiFetch<ImportConnectStatus>(apiUrl, cookie, '/api/me/soundcloud'),
      fetchMixcloudStatus(),
    ])

  return (
    <div id="social-connections">
      {socialSettings && (
        <SocialPromoPanel initial={socialSettings} apiUrl={apiUrl} title="Social connections" />
      )}

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

      <Suspense fallback={null}>
        <MixcloudConnect
          initial={{
            connected: mixcloudStatus.connected,
            configured: mixcloudStatus.configured,
          }}
          apiUrl={apiUrl}
        />
      </Suspense>
    </div>
  )
}
