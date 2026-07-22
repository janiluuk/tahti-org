// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { Panel, Text } from '@tahti/ui'
import { ImportPageLayout, ImportSteps } from '../_import-page-layout'
import { SoundCloudConnectPanel } from './_soundcloud-connect'
import { SoundCloudImportPanel } from './_soundcloud-import-panel'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

interface SoundCloudStatus {
  connected: boolean
  configured: boolean
}

async function fetchStatus(): Promise<SoundCloudStatus> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''
  const res = await fetch(`${apiUrl}/api/me/soundcloud`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return { connected: false, configured: false }
  return res.json()
}

interface ScTrack {
  id: string
  title: string
  durationMs: number
  artworkUrl: string | null
  createdAt: string
}

async function fetchTracks(connected: boolean): Promise<ScTrack[]> {
  if (!connected) return []
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''
  const res = await fetch(`${apiUrl}/api/me/soundcloud/tracks`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { tracks?: ScTrack[] }
  return data.tracks ?? []
}

const HOW_IT_WORKS = [
  'Connect your SoundCloud account',
  'Pick tracks you want to move to Tahti',
  'Tahti downloads and transcodes your audio',
  'Your tracks appear in your archive — ready to publish',
]

export default async function SoundCloudImportPage({
  searchParams,
}: {
  searchParams: { sc?: string }
}) {
  const status = await fetchStatus()
  const tracks = await fetchTracks(status.connected)
  const flash = searchParams.sc

  return (
    <ImportPageLayout
      service="soundcloud"
      title="Import from SoundCloud"
      description="Connect your SoundCloud account to import tracks you own and have enabled for download. Tahti queues each selected track for transcoding and adds it to your archive."
      asideTitle="How it works"
      aside={<ImportSteps steps={HOW_IT_WORKS} />}
    >
      <Panel title="Account connection" className="import-page__panel">
        <SoundCloudConnectPanel
          connected={status.connected}
          configured={status.configured}
          flash={flash}
        />
      </Panel>

      {status.connected && tracks.length === 0 && (
        <Panel title="No downloadable tracks" className="import-page__panel">
          <Text as="p" tone="muted" className="import-page__panel-copy">
            No downloadable tracks found on your SoundCloud account. Enable &ldquo;Allow downloads
            to fans&rdquo; in each track&apos;s permissions on SoundCloud, then refresh this page.
          </Text>
        </Panel>
      )}

      {tracks.length > 0 && (
        <Panel
          title={`Downloadable tracks (${tracks.length})`}
          description="Tahti downloads each track server-side and queues transcoding — nothing passes through your browser disk."
          className="import-page__panel"
        >
          <SoundCloudImportPanel tracks={tracks} />
        </Panel>
      )}
    </ImportPageLayout>
  )
}
