// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface CatalogTrack {
  id: string
  title: string
  durationSec: number | null
  artistName: string
  channelSlug: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

async function searchTracks(q: string): Promise<CatalogTrack[]> {
  const res = await fetch(`${API_URL}/api/v1/search/tracks?q=${encodeURIComponent(q)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { tracks: CatalogTrack[] }
  return data.tracks
}

/** "Add track" for a collaborative playlist — any logged-in listener can
 * search the Tahti catalog and add a track. Rendered only when the
 * collection is public + collaborative (checked by the caller). */
export function AddTrackButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="prof-add-track-btn" onClick={() => setOpen(true)}>
        + Add track
      </button>
      {open && <AddTrackModal slug={slug} onClose={() => setOpen(false)} />}
    </>
  )
}

function AddTrackModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogTrack[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(() => {
      searchTracks(query.trim()).then((tracks) => {
        setResults(tracks)
        setLoading(false)
      })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function addTrack(track: CatalogTrack) {
    setAddingId(track.id)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/collections/${slug}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiveItemId: track.id }),
      })
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not add track')
        return
      }
      setAddedIds((prev) => new Set(prev).add(track.id))
      router.refresh()
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div
      className="prof-embed-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add a track to this playlist"
      onClick={onClose}
    >
      <div className="prof-embed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prof-embed-modal__header">
          <h3 className="prof-embed-modal__title">Add a track</h3>
          <button type="button" className="prof-embed-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="prof-embed-modal__body">
          <input
            type="text"
            autoFocus
            placeholder="Search the Tahti catalog…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="prof-add-track-search"
          />
          {error && <p className="prof-embed-modal__hint prof-add-track-error">{error}</p>}
          <ul className="prof-add-track-results">
            {loading && <li className="prof-embed-modal__hint">Searching…</li>}
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <li className="prof-embed-modal__hint">No tracks found.</li>
            )}
            {results.map((track) => {
              const added = addedIds.has(track.id)
              return (
                <li key={track.id} className="prof-add-track-row">
                  <div className="prof-add-track-row__info">
                    <span className="prof-add-track-row__title">{track.title}</span>
                    <span className="prof-add-track-row__meta">
                      {track.artistName}
                      {track.durationSec != null && ` · ${formatDuration(track.durationSec)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="prof-add-track-row__add"
                    disabled={added || addingId === track.id}
                    onClick={() => void addTrack(track)}
                  >
                    {added ? 'Added' : addingId === track.id ? 'Adding…' : 'Add'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
