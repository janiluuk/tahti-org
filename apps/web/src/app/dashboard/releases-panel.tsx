// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReleaseChecklistItem } from '@tahti/shared'
import { createRelease, publishRelease, updateReleaseSmartLinks } from './release-actions'
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
  pLine?: string | null
  cLine?: string | null
  labelImprint?: string | null
  credits?: unknown
  revelatorStatus?: string | null
  revelatorId?: string | null
  tracks?: Array<{
    id: string
    title: string
    isrc: string | null
    musicbrainzRecordingId?: string | null
    status?: string
  }>
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

  return (
    <section
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Releases</h2>
        <a href={`/u/${username}`} style={{ fontSize: '0.85rem', color: '#2563eb' }}>
          Public profile ↗
        </a>
      </div>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Publish releases on your profile. Add DSP smart links for the public landing page at{' '}
        <code>/r/your-slug</code>.
      </p>

      {initial.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {initial.map((r) => (
            <li
              key={r.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span>
                  {r.title} · {r.state} · {r._count.tracks} track(s)
                </span>
                <span style={{ display: 'flex', gap: '0.35rem' }}>
                  {r.state === 'PUBLISHED' && (
                    <>
                      <Link href={`/r/${r.smartLinkSlug}`} style={{ fontSize: '0.8rem' }}>
                        Smart link
                        {typeof r.smartLinkViewCount === 'number' && r.smartLinkViewCount > 0
                          ? ` (${r.smartLinkViewCount} views)`
                          : ''}
                      </Link>
                      <button
                        type="button"
                        onClick={() => openSmartLinks(r)}
                        style={{ border: '1px solid #ccc', borderRadius: 4, fontSize: '0.8rem' }}
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
                      style={{
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        padding: '0.2rem 0.5rem',
                      }}
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
                  pLine: r.pLine ?? '',
                  cLine: r.cLine ?? '',
                  labelImprint: r.labelImprint ?? '',
                }}
                initialCredits={parseCredits(r.credits)}
                initialTracks={(r.tracks ?? []).map((t) => ({
                  id: t.id,
                  title: t.title,
                  isrc: t.isrc ?? '',
                  musicbrainzRecordingId: t.musicbrainzRecordingId ?? '',
                }))}
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
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            background: '#f9fafb',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
          }}
        >
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.9rem' }}>
            Streaming links
          </p>
          {DSP_FIELDS.map((f) => (
            <label
              key={f.key}
              style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}
            >
              {f.label}
              <input
                type="url"
                value={targets[f.key] ?? ''}
                onChange={(e) => setTargets((t) => ({ ...t, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '0.2rem',
                  padding: '0.4rem',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                }}
              />
            </label>
          ))}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={saveSmartLinks} disabled={isPending}>
              Save links
            </button>
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          placeholder="Release title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          type="button"
          onClick={addRelease}
          disabled={isPending}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '0.5rem 1rem',
          }}
        >
          Add draft
        </button>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>}
    </section>
  )
}
