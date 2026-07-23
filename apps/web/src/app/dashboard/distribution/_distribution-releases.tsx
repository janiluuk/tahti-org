// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ReleaseChecklistItem } from '@tahti/shared'
import ReleaseOpsPanel, { parseCredits } from '../release-ops-panel'

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

export function DistributionReleases({ releases }: { releases: ReleaseSummary[] }) {
  if (releases.length === 0) {
    return <p className="studio-text-muted-sm studio-mt-sm">No releases yet.</p>
  }

  return (
    <div className="studio-list studio-mt-sm">
      {releases.map((r) => (
        <div key={r.id} className="studio-item-row--list">
          <div className="studio-card-row">
            <div>
              <div className="studio-stat-box-title">{r.title}</div>
              <div className="studio-text-muted-sm">
                {r.type} · {r.state} · {r._count.tracks} track{r._count.tracks === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <ReleaseOpsPanel
            releaseId={r.id}
            releaseTitle={r.title}
            smartLinkSlug={r.smartLinkSlug}
            initial={{
              upc: r.upc ?? '',
              musicbrainzReleaseId: r.musicbrainzReleaseId ?? '',
              musicbrainzArtistId: r.musicbrainzArtistId ?? '',
              discogsReleaseId: r.discogsReleaseId ?? '',
              pLine: r.pLine ?? '',
              cLine: r.cLine ?? '',
              labelImprint: r.labelImprint ?? '',
            }}
            initialCredits={parseCredits(r.credits)}
            checklist={
              r.checklist ?? [
                { id: 'metadata', label: 'Release metadata', done: false },
                { id: 'identifiers', label: 'UPC / ISRC', done: false },
                { id: 'musicbrainz', label: 'MusicBrainz', done: false },
                { id: 'dsp', label: 'DSP / smart links', done: false },
                { id: 'published', label: 'Published on profile', done: r.state === 'PUBLISHED' },
              ]
            }
            revelatorStatus={r.revelatorStatus}
            revelatorId={r.revelatorId}
          />
        </div>
      ))}
    </div>
  )
}
