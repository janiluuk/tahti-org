// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
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

export default async function BandcampImportPage({
  searchParams,
}: {
  searchParams: { bc?: string }
}) {
  const status = await fetchStatus()
  const flash = searchParams.bc

  return (
    <div className="import-page">
      <div className="import-page__header">
        <Link href="/dashboard/upload" className="collection-editor__back">
          ← Add content
        </Link>
        <h1 className="import-page__title">Import from Bandcamp</h1>
      </div>

      <div className="import-page__body">
        <div className="import-page__hero">
          <span className="import-page__service-icon" aria-hidden>
            ◎
          </span>
          <p className="import-page__desc">
            Connect your Bandcamp account to import your own albums, EPs, and singles directly —
            including FLAC masters you uploaded. Only releases where you are the artist or label are
            eligible.
          </p>
        </div>

        <BandcampConnectPanel
          connected={status.connected}
          configured={status.configured}
          flash={flash}
        />

        {status.connected && (
          <div className="import-page__coming-soon">
            <h2 className="import-page__coming-title">Track listing coming soon</h2>
            <p className="import-page__coming-desc">
              Your Bandcamp account is connected. Once Tahti&apos;s Bandcamp API integration is
              approved, your albums will appear here for one-click import.
            </p>
          </div>
        )}

        <div className="import-page__steps">
          <h2 className="import-page__steps-title">How it works</h2>
          <ol className="import-page__step-list">
            <li>Connect your Bandcamp account</li>
            <li>Pick which albums or tracks to import</li>
            <li>Tahti downloads the FLAC masters and queues transcoding</li>
            <li>Your content appears in your archive — ready to publish</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
