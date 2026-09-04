// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import type { HearthisTrackResult } from '@tahti/shared'
import {
  addHearthisTrackToCollection,
  getHearthisMyTracks,
  getHearthisTracksByProfileUrl,
  searchHearthisTracks,
} from '../../collection-actions'

type Tab = 'mine' | 'search' | 'url'

type AddedResult = {
  soundId: string
  collectionItemId: string
  track: HearthisTrackResult
}

type Props = {
  collectionId: string
  collectionTitle: string
  onClose: () => void
  onAdded: (result: AddedResult) => void
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function HearthisImportModal({ collectionId, collectionTitle, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [results, setResults] = useState<HearthisTrackResult[]>([])
  const [myUsername, setMyUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    const res = await searchHearthisTracks(q.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const runByProfileUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    const res = await getHearthisTracksByProfileUrl(url.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const loadMyTracks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getHearthisMyTracks()
    setLoading(false)
    if (res.error) setError(res.error)
    setMyUsername(res.username)
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
    async (track: HearthisTrackResult) => {
      setAddingUrl(track.url)
      const res = await addHearthisTrackToCollection(collectionId, track.url)
      setAddingUrl(null)
      if (res.error || !res.soundId || !res.collectionItemId || !res.track) {
        setError(res.error ?? 'Failed to add track')
        return
      }
      setAddedUrls((prev) => new Set(prev).add(track.url))
      onAdded({
        soundId: res.soundId,
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
        className="spotify-import-modal hearthis-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add hearthis.at track"
      >
        <div className="spotify-import-modal__header">
          <div>
            <h2 className="spotify-import-modal__title">
              Add hearthis.at track to &ldquo;{collectionTitle}&rdquo;
            </h2>
            <p className="spotify-import-modal__subline">
              Downloadable tracks are copied into Tahti&rsquo;s native player in the background.
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

        <div className="spotify-import-modal__banner hearthis-import-modal__banner" role="note">
          <strong>Best available quality.</strong> Download-enabled tracks become native Tahti audio
          in the background, preserving the original file when HearThis provides it. Other tracks
          keep the HearThis player.
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
            Search hearthis.at
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'url'}
            className={`spotify-import-modal__tab${tab === 'url' ? ' spotify-import-modal__tab--active' : ''}`}
            onClick={() => setTab('url')}
          >
            By profile URL
          </button>
        </div>

        {tab === 'search' ? (
          <input
            type="search"
            className="studio-input spotify-import-modal__search-input"
            placeholder="Search hearthis.at's catalogue…"
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
              void runByProfileUrl(profileUrl)
            }}
          >
            <input
              type="text"
              className="studio-input"
              placeholder="https://hearthis.at/username/…"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
            />
            <Button type="submit" variant="primary" size="sm">
              <ButtonIcon name="search" />
              Find tracks
            </Button>
          </form>
        ) : null}

        {tab === 'mine' && !loading && myUsername == null ? (
          <p className="studio-text-muted-sm spotify-import-modal__hint">
            We don&rsquo;t have your hearthis.at handle yet — paste your own hearthis.at profile URL
            in &ldquo;By profile URL&rdquo; for now.
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
                const added = addedUrls.has(track.url)
                return (
                  <li key={track.url} className="spotify-import-modal__row">
                    {track.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={track.coverUrl} alt="" className="spotify-import-modal__cover" />
                    ) : (
                      <div className="spotify-import-modal__cover spotify-import-modal__cover--ph" />
                    )}
                    <div className="spotify-import-modal__row-info">
                      <div className="spotify-import-modal__row-title">{track.title}</div>
                      <div className="spotify-import-modal__row-meta">{track.username}</div>
                    </div>
                    <span className="spotify-import-modal__duration">
                      {formatDuration(track.durationSec)}
                    </span>
                    <Button
                      disabled={added || addingUrl === track.url}
                      onClick={() => void handleAdd(track)}
                      variant="primary"
                      size="sm"
                    >
                      {added ? '✓ Added' : addingUrl === track.url ? 'Adding…' : '+ Add'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="spotify-import-modal__footer-tip">
          own work belongs as Tahti FLAC. embeds are best for collabs, playlists &amp; sets.
        </p>
      </div>
    </div>
  )
}
