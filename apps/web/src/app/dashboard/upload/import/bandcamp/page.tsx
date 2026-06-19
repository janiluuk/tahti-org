// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { Panel, Text } from '@tahti/ui'
import { ImportPageLayout, ImportSteps } from '../_import-page-layout'
import { BandcampConnectPanel } from './_bandcamp-connect'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

interface BandcampStatus {
  connected: boolean
  configured: boolean
}

async function fetchStatus(): Promise<BandcampStatus> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''
  const res = await fetch(`${apiUrl}/api/me/bandcamp`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return { connected: false, configured: false }
  return res.json()
}

const HOW_IT_WORKS = [
  'Connect your Bandcamp account',
  'Pick which albums or tracks to import',
  'Tahti downloads the FLAC masters and queues transcoding',
  'Your content appears in your archive — ready to publish',
]

export default async function BandcampImportPage({
  searchParams,
}: {
  searchParams: { bc?: string }
}) {
  const status = await fetchStatus()
  const flash = searchParams.bc

  return (
    <ImportPageLayout
      service="bandcamp"
      title="Import from Bandcamp"
      description="Connect your Bandcamp account to import your own albums, EPs, and singles — including FLAC masters you uploaded. Only releases where you are the artist or label are eligible."
      asideTitle="How it works"
      aside={<ImportSteps steps={HOW_IT_WORKS} />}
    >
      <Panel title="Account connection" className="import-page__panel">
        <BandcampConnectPanel
          connected={status.connected}
          configured={status.configured}
          flash={flash}
        />
      </Panel>

      {status.connected && (
        <Panel title="Your releases" className="import-page__panel">
          <Text as="p" tone="muted" className="import-page__panel-copy">
            Your Bandcamp account is connected. Once Tahti&apos;s Bandcamp API integration is
            approved, your albums will appear here for one-click import.
          </Text>
        </Panel>
      )}
    </ImportPageLayout>
  )
}
