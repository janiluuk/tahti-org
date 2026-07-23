// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { Heading, PageShell, Panel } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { fetchSpotifyProfile } from '../spotify-profile-actions'
import { SpotifyProfilePanel } from '../spotify-profile-panel'
import { DistributionReleases } from './_distribution-releases'

interface ReleaseSummary {
  id: string
  title: string
  type: string
  state: string
  smartLinkSlug: string
  upc?: string | null
  musicbrainzReleaseId?: string | null
  musicbrainzArtistId?: string | null
  discogsReleaseId?: string | null
  pLine?: string | null
  cLine?: string | null
  labelImprint?: string | null
  credits?: unknown
  revelatorStatus?: string | null
  revelatorId?: string | null
  checklist?: ReleaseChecklistItem[]
  _count: { tracks: number }
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

export default async function DistributionPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, releasesPage, spotifyProfile] = await Promise.all([
    getDashboardUser(),
    apiFetch<{ releases: ReleaseSummary[] }>(apiUrl, cookie, '/api/me/releases?limit=100'),
    fetchSpotifyProfile(),
  ])
  if (!user) redirect('/login')
  const releases = releasesPage?.releases ?? []

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Distribution</Heading>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user.channel)}
            isLive={user.channel?.state === 'LIVE'}
            channelSlug={user.channel?.slug}
            showBack
          />
        </div>
      </div>

      <SpotifyProfilePanel
        initial={spotifyProfile.profile}
        configured={spotifyProfile.configured}
      />

      <Panel
        title="DSP delivery & catalog metadata"
        headerTight
        description="Submit releases to Revelator for streaming platforms, and track UPC/ISRC/MusicBrainz identifiers."
        className="studio-mt-md"
      >
        <DistributionReleases releases={releases} />
      </Panel>
    </PageShell>
  )
}
