// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { publishRelease, updateReleaseDate, updateReleaseSmartLinks } from '../../release-actions'
import ReleaseOpsPanel, { parseCredits } from '../../release-ops-panel'
import { ReleaseArtworkUpload } from '../../release-artwork-upload'
import { ReleaseTrackVersionPanel } from '../../release-track-version-panel'
import ReleaseVisualPanel from '../../release-visual-panel'

const DSP_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/...' },
  { key: 'apple', label: 'Apple Music', placeholder: 'https://music.apple.com/...' },
  { key: 'bandcamp', label: 'Bandcamp', placeholder: 'https://artist.bandcamp.com/...' },
  { key: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/...' },
  { key: 'youtube', label: 'YouTube Music', placeholder: 'https://music.youtube.com/...' },
  { key: 'tidal', label: 'Tidal', placeholder: 'https://listen.tidal.com/...' },
]

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

export function ReleaseDetail({ release: r }: { release: ReleaseSummary }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [targets, setTargets] = useState<Record<string, string>>(
    r.smartLinkTargets && typeof r.smartLinkTargets === 'object'
      ? (r.smartLinkTargets as Record<string, string>)
      : {},
  )
  const [error, setError] = useState<string | null>(null)
  const [releaseDate, setReleaseDate] = useState(r.releaseDate.slice(0, 10))
  const [dateSaving, setDateSaving] = useState(false)
  const [dateSaved, setDateSaved] = useState(false)

  function publish() {
    startTransition(async () => {
      await publishRelease(r.id)
      router.refresh()
    })
  }

  function saveReleaseDate() {
    setError(null)
    setDateSaving(true)
    setDateSaved(false)
    startTransition(async () => {
      const res = await updateReleaseDate(r.id, releaseDate)
      setDateSaving(false)
      if (res.error) {
        setError(res.error)
        return
      }
      setDateSaved(true)
      router.refresh()
    })
  }

  function saveSmartLinks() {
    setError(null)
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(targets)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    startTransition(async () => {
      const res = await updateReleaseSmartLinks(r.id, cleaned)
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="studio-release-detail">
      <Panel headerTight className="studio-mb-md">
        <div className="studio-row--between studio-gap-xs">
          <div className="studio-release-card__meta">
            {r.state} · {r._count.tracks} track{r._count.tracks === 1 ? '' : 's'}
          </div>
          <div className="studio-actions studio-actions--sm">
            {r.state === 'PUBLISHED' ? (
              <Link href={`/r/${r.smartLinkSlug}`} className="ui-btn ui-btn--sm ui-btn--ghost">
                Smart link
                {typeof r.smartLinkViewCount === 'number' && r.smartLinkViewCount > 0
                  ? ` (${r.smartLinkViewCount})`
                  : ''}
              </Link>
            ) : (
              <Button onClick={publish} disabled={isPending} variant="primary" size="sm">
                <ButtonIcon name="send" />
                Publish
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Release date" headerTight className="studio-mb-md">
        <div className="studio-row studio-row--wrap studio-gap-xs">
          <input
            type="date"
            value={releaseDate}
            disabled={dateSaving}
            onChange={(e) => {
              setReleaseDate(e.target.value)
              setDateSaved(false)
            }}
            className="studio-input"
          />
          <Button onClick={saveReleaseDate} disabled={dateSaving} variant="primary" size="sm">
            <ButtonIcon name="save" />
            {dateSaving ? 'Saving…' : 'Save'}
          </Button>
          {dateSaved && <span className="studio-text-muted-sm">Saved.</span>}
        </div>
      </Panel>

      <ReleaseArtworkUpload releaseId={r.id} artworkUrl={r.artworkUrl} />

      {(r.tracks ?? []).map((t) => (
        <ReleaseTrackVersionPanel key={t.id} releaseId={r.id} trackId={t.id} trackTitle={t.title} />
      ))}

      <Panel
        title="Streaming links"
        headerTight
        description="DSP URLs shown on the public smart-link page."
        className="studio-mt-md"
      >
        {DSP_FIELDS.map((f) => (
          <div key={f.key} className="studio-field--block">
            <label className="studio-label" htmlFor={`dsp-${f.key}`}>
              {f.label}
            </label>
            <input
              id={`dsp-${f.key}`}
              type="url"
              value={targets[f.key] ?? ''}
              onChange={(e) => setTargets((t) => ({ ...t, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="studio-input"
            />
          </div>
        ))}
        <div className="studio-actions studio-mt-md">
          <Button onClick={saveSmartLinks} disabled={isPending} variant="primary">
            <ButtonIcon name="save" />
            Save links
          </Button>
        </div>
        {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
      </Panel>

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

      <ReleaseVisualPanel
        releaseId={r.id}
        initial={{
          visualPreset: (r.visualPreset ?? 'MINIMAL') as import('@tahti/shared').VisualPreset,
          colorSchemeJson: r.colorSchemeJson ?? null,
          paletteJson: r.paletteJson ?? null,
        }}
      />
    </div>
  )
}
