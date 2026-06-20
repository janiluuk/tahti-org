// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { Panel } from '@tahti/ui'
import { ImportPageLayout, ImportSteps } from '../_import-page-layout'
import { GoogleDriveConnectPanel } from './_google-drive-connect'
import { GoogleDrivePickerPanel } from './_google-drive-picker'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

interface GoogleDriveStatus {
  connected: boolean
  configured: boolean
}

async function fetchStatus(): Promise<GoogleDriveStatus> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''
  const res = await fetch(`${apiUrl}/api/me/google-drive`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return { connected: false, configured: false }
  return res.json()
}

const HOW_IT_WORKS = [
  'Connect your Google account (drive.file scope only)',
  'Pick audio files with the Google Drive file picker',
  'Tahti downloads each file server-side into your archive',
  'Open the editor to polish metadata and publish',
]

export default async function GoogleDriveImportPage({
  searchParams,
}: {
  searchParams: { gd?: string }
}) {
  const status = await fetchStatus()
  const flash = searchParams.gd

  return (
    <ImportPageLayout
      service="google-drive"
      title="Import from Google Drive"
      description="Pull audio from your own Google Drive without downloading to disk first. Tahti transfers files server-side, transcodes them, and adds them to your archive."
      asideTitle="How it works"
      aside={<ImportSteps steps={HOW_IT_WORKS} />}
    >
      <Panel title="Account connection" className="import-page__panel">
        <GoogleDriveConnectPanel
          connected={status.connected}
          configured={status.configured}
          flash={flash}
        />
      </Panel>

      {status.connected && (
        <Panel title="Choose files" className="import-page__panel">
          <GoogleDrivePickerPanel connected={status.connected} />
        </Panel>
      )}
    </ImportPageLayout>
  )
}
