// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem, ChannelGalleryMode } from '@tahti/shared'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { publishRelease, updateReleaseDate, updateReleaseSmartLinks } from '../../release-actions'
import ReleaseOpsPanel, { parseCredits } from '../../release-ops-panel'
import { ReleaseArtworkUpload } from '../../release-artwork-upload'
import { ReleaseTrackVersionPanel } from '../../release-track-version-panel'
import { ReleaseTrackCreditsPanel, parseTrackCredits } from '../../release-track-credits-panel'
import ReleaseVisualPanel from '../../release-visual-panel'
import { MusicbrainzRegisterPanel } from './_musicbrainz-register-panel'
import {
  CatalogPlaybackButtons,
  type CatalogPlaybackTrack,
} from '@/components/catalog-playback-buttons'

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
  artistName?: string
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
  slideshowImages?: string[]
  galleryMode?: ChannelGalleryMode
  galleryAudioReactive?: boolean
  tracks?: Array<{
    id: string
    title: string
    isrc: string | null
    status?: string
    durationSec?: number | null
    audioUrl?: string | null
    credits?: unknown
    fingerprintMatch?: {
      acoustidId: string
      score: number
      recordingId?: string
      title?: string
      artist?: string
    } | null
  }>
  checklist?: ReleaseChecklistItem[]
  _count: { tracks: number }
}

type FingerprintMatch = NonNullable<
  NonNullable<ReleaseSummary['tracks']>[number]['fingerprintMatch']
>

function FingerprintMatchNote({
  status,
  match,
}: {
  status?: string
  match?: FingerprintMatch | null
}) {
  if (status === 'PENDING' || status === 'SCANNING' || status === 'TRANSCODING') {
    return <p className="studio-text-muted-sm">Checking for a fingerprint match…</p>
  }
  if (status !== 'READY') return null

  if (!match) {
    return <p className="studio-text-muted-sm">No fingerprint match found — likely original.</p>
  }

  const pct = Math.round(match.score * 100)
  if (match.title) {
    return (
      <p className="studio-text-error studio-text-sm">
        ⚠ Fingerprint matches an existing recording: “{match.title}”
        {match.artist ? ` by ${match.artist}` : ''} ({pct}% confidence)
        {match.recordingId && (
          <>
            {' — '}
            <a
              href={`https://musicbrainz.org/recording/${match.recordingId}`}
              target="_blank"
              rel="noreferrer"
            >
              view on MusicBrainz
            </a>
          </>
        )}
      </p>
    )
  }
  return (
    <p className="studio-text-muted-sm">
      Fingerprint matches a known recording ({pct}% confidence) — no title/artist metadata linked
      yet.
    </p>
  )
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
  const playbackQueue: CatalogPlaybackTrack[] = (r.tracks ?? []).flatMap((track) =>
    track.audioUrl
      ? [
          {
            id: `release-track-${track.id}`,
            title: track.title,
            audioUrl: track.audioUrl,
            subtitle: r.artistName,
            artworkUrl: r.artworkUrl,
          },
        ]
      : [],
  )

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
        {r.state === 'PUBLISHED' && (
          <MusicbrainzRegisterPanel
            release={{
              title: r.title,
              artistName: r.artistName ?? '',
              type: r.type as 'SINGLE' | 'EP' | 'ALBUM' | 'COMPILATION' | 'REMIX',
              releaseDate: r.releaseDate,
              upc: r.upc,
              tracks: (r.tracks ?? []).map((t) => ({ title: t.title, durationSec: t.durationSec })),
              sourceUrl: `https://tahti.live/r/${r.smartLinkSlug}`,
            }}
          />
        )}
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
        <div key={t.id}>
          {t.audioUrl ? (
            <div className="studio-row studio-row--between studio-mb-sm">
              <strong>{t.title}</strong>
              <CatalogPlaybackButtons
                item={{
                  id: `release-track-${t.id}`,
                  title: t.title,
                  audioUrl: t.audioUrl,
                  subtitle: r.artistName,
                  artworkUrl: r.artworkUrl,
                }}
                queue={playbackQueue}
              />
            </div>
          ) : null}
          <ReleaseTrackVersionPanel releaseId={r.id} trackId={t.id} trackTitle={t.title} />
          <FingerprintMatchNote status={t.status} match={t.fingerprintMatch} />
          <ReleaseTrackCreditsPanel
            releaseId={r.id}
            trackId={t.id}
            trackTitle={t.title}
            initialCredits={parseTrackCredits(t.credits)}
          />
        </div>
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
          slideshowImages: r.slideshowImages ?? [],
          galleryMode: r.galleryMode ?? 'NONE',
          galleryAudioReactive: r.galleryAudioReactive ?? false,
        }}
      />
    </div>
  )
}
