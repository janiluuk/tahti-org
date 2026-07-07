// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import type { SpotifyTrackResult } from '@tahti/shared'
import {
  addSpotifyTrackToCollection,
  getSpotifyMyTracks,
  getSpotifyTracksByArtistUrl,
  searchSpotifyTracks,
} from '../../collection-actions'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

type Tab = 'mine' | 'search' | 'url'

type AddedResult = {
  archiveItemId: string
  collectionItemId: string
  track: SpotifyTrackResult
}

type Props = {
  collectionId: string
  collectionTitle: string
  onClose: () => void
  onAdded: (result: AddedResult) => void
}

/** Routes a Spotify cover-art URL through the backend proxy — never hot-link i.scdn.co from the browser. */
export function spotifyCoverProxySrc(coverUrl: string | null): string | null {
  if (!coverUrl) return null
  return `${apiUrl}/api/v1/imports/spotify/cover?url=${encodeURIComponent(coverUrl)}`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SpotifyImportModal({ collectionId, collectionTitle, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [artistUrl, setArtistUrl] = useState('')
  const [results, setResults] = useState<SpotifyTrackResult[]>([])
  const [myArtistId, setMyArtistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingUri, setAddingUri] = useState<string | null>(null)
  const [addedUris, setAddedUris] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    const res = await searchSpotifyTracks(q.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const runByArtistUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    const res = await getSpotifyTracksByArtistUrl(url.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const loadMyTracks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getSpotifyMyTracks()
    setLoading(false)
    if (res.error) setError(res.error)
    setMyArtistId(res.artistId)
    setResults(res.tracks)
  }, [])

  useEffect(() => {
    if (tab === 'mine') void loadMyTracks()
    else setResults([])
    // Switching tabs starts from a clean slate — each tab owns its own query state.
    setError(null)
  }, [tab, loadMyTracks])

  useEffect(() => {
    if (tab !== 'search') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, tab, runSearch])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleAdd = useCallback(
    async (track: SpotifyTrackResult) => {
      setAddingUri(track.uri)
      const res = await addSpotifyTrackToCollection(collectionId, track.uri)
      setAddingUri(null)
      if (res.error || !res.archiveItemId || !res.collectionItemId || !res.track) {
        setError(res.error ?? 'Failed to add track')
        return
      }
      setAddedUris((prev) => new Set(prev).add(track.uri))
      onAdded({
        archiveItemId: res.archiveItemId,
        collectionItemId: res.collectionItemId,
        track: res.track,
      })
    },
    [collectionId, onAdded],
  )

  return (
    <div
      className="spotify-import-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="spotify-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Spotify track"
      >
        <div className="spotify-import-modal__header">
          <div>
            <h2 className="spotify-import-modal__title">
              Add Spotify track to &ldquo;{collectionTitle}&rdquo;
            </h2>
            <p className="spotify-import-modal__subline">
              these will play via Spotify&rsquo;s embed · not Tahti&rsquo;s FLAC
            </p>
          </div>
          <button
            type="button"
            className="spotify-import-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="spotify-import-modal__banner" role="note">
          <strong>Honest about quality.</strong> Spotify tracks render as embedded players in your
          collection. Listeners need a Spotify account to hear full tracks (30-second previews
          otherwise). Best for compilations with collaborators&rsquo; tracks — not for your own work
          you have masters of.
        </div>

        <div className="spotify-import-modal__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={`spotify-import-modal__tab${tab === 'mine' ? ' spotify-import-modal__tab--active' : ''}`}
            onClick={() => setTab('mine')}
          >
            Your tracks
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'search'}
            className={`spotify-import-modal__tab${tab === 'search' ? ' spotify-import-modal__tab--active' : ''}`}
            onClick={() => setTab('search')}
          >
            Search Spotify
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'url'}
            className={`spotify-import-modal__tab${tab === 'url' ? ' spotify-import-modal__tab--active' : ''}`}
            onClick={() => setTab('url')}
          >
            By artist URL
          </button>
        </div>

        {tab === 'search' ? (
          <input
            type="search"
            className="studio-input spotify-import-modal__search-input"
            placeholder="Search Spotify's catalogue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        ) : null}

        {tab === 'url' ? (
          <form
            className="spotify-import-modal__url-row"
            onSubmit={(e) => {
              e.preventDefault()
              void runByArtistUrl(artistUrl)
            }}
          >
            <input
              type="text"
              className="studio-input"
              placeholder="https://open.spotify.com/artist/…"
              value={artistUrl}
              onChange={(e) => setArtistUrl(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm">
              <ButtonIcon name="search" />
              Find tracks
            </Button>
          </form>
        ) : null}

        {tab === 'mine' && !loading && myArtistId == null ? (
          <p className="studio-text-muted-sm spotify-import-modal__hint">
            We don&rsquo;t have your Spotify artist profile yet —{' '}
            <a href="/dashboard/settings/connections">link it in Settings → Connections</a> and
            it&rsquo;ll auto-load here every time. Or paste your artist URL in &ldquo;By artist
            URL&rdquo; for a one-off lookup.
          </p>
        ) : null}

        {error ? <p className="studio-text-error studio-text-sm">{error}</p> : null}

        <div className="spotify-import-modal__results">
          {loading ? (
            <p className="studio-text-muted-sm">Loading…</p>
          ) : results.length === 0 ? (
            <p className="studio-text-muted-sm">No tracks yet.</p>
          ) : (
            <ul className="spotify-import-modal__list">
              {results.map((track) => {
                const cover = spotifyCoverProxySrc(track.coverUrl)
                const added = addedUris.has(track.uri)
                return (
                  <li key={track.uri} className="spotify-import-modal__row">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="spotify-import-modal__cover" />
                    ) : (
                      <div className="spotify-import-modal__cover spotify-import-modal__cover--ph" />
                    )}
                    <div className="spotify-import-modal__row-info">
                      <div className="spotify-import-modal__row-title">{track.title}</div>
                      <div className="spotify-import-modal__row-meta">
                        {track.artists.join(', ')}
                        {track.album ? <em> · {track.album}</em> : null}
                      </div>
                    </div>
                    <span className="spotify-import-modal__duration">
                      {formatDuration(track.durationSec)}
                    </span>
                    <Button
                      disabled={added || addingUri === track.uri}
                      onClick={() => void handleAdd(track)}
                      variant="primary"
                      size="sm"
                    >
                      {added ? '✓ Added' : addingUri === track.uri ? 'Adding…' : '+ Add'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="spotify-import-modal__footer-tip">
          own work belongs as Tahti FLAC. embeds are best for collabs &amp; references.
        </p>
      </div>
    </div>
  )
}
