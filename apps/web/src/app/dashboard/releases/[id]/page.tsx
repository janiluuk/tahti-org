// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { Heading, PageShell } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import { ReleaseDetail } from './_release-detail'

interface ReleaseSummary {
  id: string
  title: string
  type: string
  state: string
  releaseDate: string
  description?: string | null
  artworkUrl?: string | null
  smartLinkSlug: string
  smartLinkViewCount?: number
  smartLinkTargets: Record<string, string> | null
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
  visualPreset?: string | null
  colorSchemeJson?: string | null
  paletteJson?: string | null
  tracks?: Array<{ id: string; title: string; isrc: string | null; status?: string }>
  checklist?: ReleaseChecklistItem[]
  _count: { tracks: number }
}

export default async function ReleaseDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, releasesRes] = await Promise.all([
    getDashboardUser(),
    fetch(`${apiUrl}/api/me/releases?limit=100`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    }),
  ])
  if (!user) redirect('/login')

  const releases = releasesRes.ok
    ? ((await releasesRes.json()) as { releases: ReleaseSummary[] }).releases
    : []
  const release = releases.find((r) => r.id === params.id)
  if (!release) notFound()

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>{release.title}</Heading>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user.channel)}
            isLive={user.channel?.state === 'LIVE'}
            channelSlug={user.channel?.slug}
            showBack
            backHref="/dashboard/releases"
            backLabel="Releases"
          />
        </div>
      </div>

      <ReleaseDetail release={release} />
    </PageShell>
  )
}
