// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import {
  createRelease,
  importReleasesFromCsv,
  publishRelease,
  updateReleasePinned,
} from './release-actions'
import { ReleaseBulkDrop } from './_release-bulk-drop'

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
  pinnedAt?: string | null
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

  function togglePin(id: string, pinned: boolean) {
    startTransition(async () => {
      await updateReleasePinned(id, pinned)
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
        <Link href={`/u/${username}`} className="ui-btn ui-btn--sm ui-btn--ghost">
          Public profile ↗
        </Link>
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
                    {r.pinnedAt && ' · Pinned'}
                  </div>
                </div>
                <div className="studio-actions studio-actions--sm">
                  {r.state === 'PUBLISHED' && (
                    <Button
                      onClick={() => togglePin(r.id, !r.pinnedAt)}
                      disabled={isPending}
                      variant="ghost"
                      size="sm"
                    >
                      {r.pinnedAt ? 'Unpin from Stage' : 'Pin to Stage'}
                    </Button>
                  )}
                  {r.state === 'PUBLISHED' && (
                    <Link
                      href={`/r/${r.smartLinkSlug}`}
                      className="ui-btn ui-btn--sm ui-btn--ghost"
                    >
                      Smart link
                      {typeof r.smartLinkViewCount === 'number' && r.smartLinkViewCount > 0
                        ? ` (${r.smartLinkViewCount})`
                        : ''}
                    </Link>
                  )}
                  {r.state === 'DRAFT' && (
                    <Button
                      onClick={() => publish(r.id)}
                      disabled={isPending}
                      variant="primary"
                      size="sm"
                    >
                      <ButtonIcon name="send" />
                      Publish
                    </Button>
                  )}
                  <Link
                    href={`/dashboard/releases/${r.id}`}
                    className="ui-btn ui-btn--sm ui-btn--secondary"
                  >
                    Manage →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="studio-input-row studio-mt-md">
        <input
          placeholder="Release title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="studio-input studio-input--grow"
          aria-label="New release title"
        />
        <Button onClick={addRelease} disabled={isPending} variant="primary">
          <ButtonIcon name="plus" />
          Add draft
        </Button>
      </div>

      <details className="studio-details-block">
        <summary>Create an album by dragging in your tracks</summary>
        <p className="studio-help studio-mt-sm">
          Drop a folder of WAV/FLAC/MP3 files (or select several at once) — track order and titles
          come from the filenames, so name them like &quot;01 - Intro.wav&quot;.
        </p>
        <ReleaseBulkDrop />
      </details>

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
        <Button
          onClick={runBulkImport}
          disabled={isPending}
          variant="secondary"
          className="studio-mt-sm"
        >
          Import drafts
        </Button>
        {importMsg ? (
          <p className="studio-notice studio-notice--success studio-mt-sm">{importMsg}</p>
        ) : null}
      </details>

      {error ? <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p> : null}
    </Panel>
  )
}
