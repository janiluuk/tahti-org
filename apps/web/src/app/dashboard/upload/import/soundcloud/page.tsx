// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { SoundCloudConnectPanel } from './_soundcloud-connect'

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

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

export default async function SoundCloudImportPage({
  searchParams,
}: {
  searchParams: { sc?: string }
}) {
  const status = await fetchStatus()
  const tracks = await fetchTracks(status.connected)
  const flash = searchParams.sc

  return (
    <div className="import-page">
      <div className="import-page__header">
        <Link href="/dashboard/upload" className="collection-editor__back">
          ← Add content
        </Link>
        <h1 className="import-page__title">Import from SoundCloud</h1>
      </div>

      <div className="import-page__body">
        <div className="import-page__hero">
          <span className="import-page__service-icon" aria-hidden>
            ◉
          </span>
          <p className="import-page__desc">
            Connect your SoundCloud account to import tracks you own and have enabled for download.
            Tahti will queue each selected track for transcoding and add it to your archive.
          </p>
        </div>

        <SoundCloudConnectPanel
          connected={status.connected}
          configured={status.configured}
          flash={flash}
        />

        {status.connected && tracks.length === 0 && (
          <div className="import-page__coming-soon">
            <p className="import-page__coming-desc">
              No downloadable tracks found on your SoundCloud account. Make sure your tracks have
              &ldquo;Enable downloads&rdquo; enabled in SoundCloud&apos;s track settings.
            </p>
          </div>
        )}

        {tracks.length > 0 && (
          <div className="import-page__track-list">
            <h2 className="import-page__steps-title">Downloadable tracks ({tracks.length})</h2>
            <p className="import-page__coming-desc">
              One-click import is coming soon. In the meantime, download your FLAC masters from
              SoundCloud and upload them via the file drop.
            </p>
            <ol className="from-broadcast-page__list">
              {tracks.map((t) => (
                <li key={t.id} className="broadcast-row">
                  <div className="broadcast-row__info">
                    <span className="broadcast-row__name">{t.title}</span>
                    <span className="broadcast-row__meta">{formatDuration(t.durationMs)}</span>
                  </div>
                  <span className="broadcast-row__status broadcast-row__status--pending">
                    Import coming soon
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {!status.connected && (
          <div className="import-page__steps">
            <h2 className="import-page__steps-title">How it works</h2>
            <ol className="import-page__step-list">
              <li>Connect your SoundCloud account</li>
              <li>Pick tracks you want to move to Tahti</li>
              <li>Tahti downloads and transcodes your audio</li>
              <li>Your tracks appear in your archive — ready to publish</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
