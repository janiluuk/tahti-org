// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { Panel } from '@tahti/ui'
import {
  createRelease,
  importReleasesFromCsv,
  publishRelease,
  updateReleaseSmartLinks,
} from './release-actions'
import ReleaseOpsPanel, { parseCredits } from './release-ops-panel'
import { ReleaseArtworkUpload } from './release-artwork-upload'
import { ReleaseTrackVersionPanel } from './release-track-version-panel'
import ReleaseVisualPanel from './release-visual-panel'

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

export default function ReleasesPanel({
  initial,
  username,
}: {
  initial: ReleaseSummary[]
  username: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [importCsv, setImportCsv] = useState('')
  const [importMsg, setImportMsg] = useState<string | null>(null)

  function addRelease() {
    setError(null)
    if (!title.trim()) return
    startTransition(async () => {
      const res = await createRelease({
        title: title.trim(),
        type: 'SINGLE',
        releaseDate: new Date().toISOString().slice(0, 10),
        tracks: [{ title: title.trim() }],
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setTitle('')
      router.refresh()
    })
  }

  function publish(id: string) {
    startTransition(async () => {
      await publishRelease(id)
      router.refresh()
    })
  }

  function openSmartLinks(r: ReleaseSummary) {
    const existing =
      r.smartLinkTargets && typeof r.smartLinkTargets === 'object'
        ? (r.smartLinkTargets as Record<string, string>)
        : {}
    setTargets(existing)
    setEditingId(r.id)
    setError(null)
  }

  function saveSmartLinks() {
    if (!editingId) return
    setError(null)
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(targets)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    startTransition(async () => {
      const res = await updateReleaseSmartLinks(editingId, cleaned)
      if (res.error) {
        setError(res.error)
        return
      }
      setEditingId(null)
      router.refresh()
    })
  }

  function runBulkImport() {
    setImportMsg(null)
    setError(null)
    if (!importCsv.trim()) return
    startTransition(async () => {
      const res = await importReleasesFromCsv(importCsv)
      if (res.error) {
        setError(res.error)
        return
      }
      setImportMsg(`Imported ${res.created ?? 0} draft release(s).`)
      setImportCsv('')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Releases & smart links"
      headerTight
      description={
        <>
          Publish releases on your profile. DSP links power the public landing page at{' '}
          <code>/r/your-slug</code>.
        </>
      }
      className="import-page__panel"
      flushTop
    >
      <div className="studio-row--between studio-mb-sm">
        <span className="studio-text-muted-sm">
          {initial.length} release{initial.length === 1 ? '' : 's'}
        </span>
        <a href={`/u/${username}`} className="ui-btn ui-btn--sm ui-btn--ghost">
          Public profile ↗
        </a>
      </div>

      {initial.length > 0 && (
        <ul className="studio-list">
          {initial.map((r) => (
            <li key={r.id} className="studio-release-card">
              <div className="studio-row--between studio-gap-xs">
                <div>
                  <div className="studio-release-card__title">{r.title}</div>
                  <div className="studio-release-card__meta">
                    {r.state} · {r._count.tracks} track{r._count.tracks === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="studio-actions studio-actions--sm">
                  {r.state === 'PUBLISHED' && (
                    <>
                      <Link
                        href={`/r/${r.smartLinkSlug}`}
                        className="ui-btn ui-btn--sm ui-btn--ghost"
                      >
                        Smart link
                        {typeof r.smartLinkViewCount === 'number' && r.smartLinkViewCount > 0
                          ? ` (${r.smartLinkViewCount})`
                          : ''}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openSmartLinks(r)}
                        className="ui-btn ui-btn--sm ui-btn--secondary"
                      >
                        DSP URLs
                      </button>
                    </>
                  )}
                  {r.state === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => publish(r.id)}
                      disabled={isPending}
                      className="ui-btn ui-btn--sm ui-btn--primary"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>

              <ReleaseArtworkUpload releaseId={r.id} artworkUrl={r.artworkUrl} />
              {(r.tracks ?? []).map((t) => (
                <ReleaseTrackVersionPanel
                  key={t.id}
                  releaseId={r.id}
                  trackId={t.id}
                  trackTitle={t.title}
                  trackStatus={t.status ?? 'PENDING'}
                />
              ))}
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
                    {
                      id: 'published',
                      label: 'Published on profile',
                      done: r.state === 'PUBLISHED',
                    },
                  ]
                }
                revelatorStatus={r.revelatorStatus}
                revelatorId={r.revelatorId}
              />
              <ReleaseVisualPanel
                releaseId={r.id}
                initial={{
                  visualPreset: (r.visualPreset ??
                    'MINIMAL') as import('@tahti/shared').VisualPreset,
                  colorSchemeJson: r.colorSchemeJson ?? null,
                  paletteJson: r.paletteJson ?? null,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {editingId && (
        <div className="studio-smart-links-panel studio-mt-md">
          <p className="studio-label studio-mb-sm">Streaming links</p>
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
            <button
              type="button"
              onClick={saveSmartLinks}
              disabled={isPending}
              className="ui-btn ui-btn--primary"
            >
              Save links
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="ui-btn ui-btn--ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="studio-input-row studio-mt-md">
        <input
          placeholder="Release title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="studio-input studio-input--grow"
          aria-label="New release title"
        />
        <button
          type="button"
          onClick={addRelease}
          disabled={isPending}
          className="ui-btn ui-btn--primary"
        >
          Add draft
        </button>
      </div>

      <details className="studio-details-block">
        <summary>Bulk import from CSV</summary>
        <p className="studio-help studio-mt-sm">
          One row per track. Columns: releaseTitle, type, releaseDate (YYYY-MM-DD), trackTitle,
          isrc, upc, description.
        </p>
        <textarea
          value={importCsv}
          onChange={(e) => setImportCsv(e.target.value)}
          rows={5}
          className="studio-input studio-mt-sm"
          placeholder={`releaseTitle,type,releaseDate,trackTitle\nMy EP,EP,2026-06-01,Track 1`}
        />
        <button
          type="button"
          onClick={runBulkImport}
          disabled={isPending}
          className="ui-btn ui-btn--secondary studio-mt-sm"
        >
          Import drafts
        </button>
        {importMsg ? (
          <p className="studio-notice studio-notice--success studio-mt-sm">{importMsg}</p>
        ) : null}
      </details>

      {error ? <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p> : null}
    </Panel>
  )
}
