// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem } from '@tahti/shared'
import {
  createRelease,
  importReleasesFromCsv,
  publishRelease,
  updateReleaseSmartLinks,
} from './release-actions'
import ReleaseOpsPanel, { parseCredits } from './release-ops-panel'
import { ReleaseArtworkUpload } from './release-artwork-upload'
import { ReleaseTrackVersionPanel } from './release-track-version-panel'

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
    <section className="studio-panel-section">
      <div className="studio-row--between">
        <h2 className="studio-section-heading studio-m-0">Releases</h2>
        <a href={`/u/${username}`} className="studio-link-cta">
          Public profile ↗
        </a>
      </div>
      <p className="studio-help">
        Publish releases on your profile. Add DSP smart links for the public landing page at{' '}
        <code>/r/your-slug</code>.
      </p>

      {initial.length > 0 && (
        <ul className="studio-list studio-mt-lg">
          {initial.map((r) => (
            <li key={r.id} className="studio-item-row--list">
              <div className="studio-card-row">
                <span>
                  {r.title} · {r.state} · {r._count.tracks} track(s)
                </span>
                <span className="studio-actions studio-actions--sm">
                  {r.state === 'PUBLISHED' && (
                    <>
                      <Link href={`/r/${r.smartLinkSlug}`} className="studio-text-sm">
                        Smart link
                        {typeof r.smartLinkViewCount === 'number' && r.smartLinkViewCount > 0
                          ? ` (${r.smartLinkViewCount} views)`
                          : ''}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openSmartLinks(r)}
                        className="studio-btn-ghost"
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
                      className="studio-btn-ghost"
                    >
                      Publish
                    </button>
                  )}
                </span>
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
            </li>
          ))}
        </ul>
      )}

      {editingId && (
        <div className="studio-smart-links-panel">
          <p className="studio-text-strong-sm studio-m-0 studio-mb-md">Streaming links</p>
          {DSP_FIELDS.map((f) => (
            <label key={f.key} className="studio-field studio-text-muted-sm">
              {f.label}
              <input
                type="url"
                value={targets[f.key] ?? ''}
                onChange={(e) => setTargets((t) => ({ ...t, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="studio-input studio-mt-sm"
              />
            </label>
          ))}
          <div className="studio-actions studio-mt-md">
            <button
              type="button"
              onClick={saveSmartLinks}
              disabled={isPending}
              className="studio-btn-primary"
            >
              Save links
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="studio-btn-ghost">
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
          className="studio-input studio-flex-1"
        />
        <button
          type="button"
          onClick={addRelease}
          disabled={isPending}
          className="studio-btn-primary"
        >
          Add draft
        </button>
      </div>

      <details className="studio-mt-md">
        <summary className="studio-text-strong-sm">Bulk import from CSV</summary>
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
          className="studio-btn-ghost studio-mt-sm"
        >
          Import drafts
        </button>
        {importMsg ? <p className="studio-text-muted-sm studio-mt-sm">{importMsg}</p> : null}
      </details>

      {error && <p className="studio-text-error">{error}</p>}
    </section>
  )
}
