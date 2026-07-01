// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonIcon } from '@tahti/ui'
import type { MixcloudTrackResult } from '@tahti/shared'
import {
  addMixcloudTrackToCollection,
  getMixcloudMyTracks,
  getMixcloudTracksByProfileUrl,
  searchMixcloudTracks,
} from '../../collection-actions'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

type Tab = 'mine' | 'search' | 'url'

type AddedResult = {
  archiveItemId: string
  collectionItemId: string
  track: MixcloudTrackResult
}

type Props = {
  collectionId: string
  collectionTitle: string
  onClose: () => void
  onAdded: (result: AddedResult) => void
}

/** Routes a Mixcloud cover-art URL through the backend proxy — never hot-link thumbnailer.mixcloud.com from the browser. */
export function mixcloudCoverProxySrc(coverUrl: string | null): string | null {
  if (!coverUrl) return null
  return `${apiUrl}/api/v1/imports/mixcloud/cover?url=${encodeURIComponent(coverUrl)}`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function MixcloudImportModal({ collectionId, collectionTitle, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [results, setResults] = useState<MixcloudTrackResult[]>([])
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
    const res = await searchMixcloudTracks(q.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const runByProfileUrl = useCallback(async (url: string) => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    const res = await getMixcloudTracksByProfileUrl(url.trim())
    setLoading(false)
    if (res.error) setError(res.error)
    setResults(res.tracks)
  }, [])

  const loadMyTracks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await getMixcloudMyTracks()
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
    async (track: MixcloudTrackResult) => {
      setAddingUrl(track.url)
      const res = await addMixcloudTrackToCollection(collectionId, track.url)
      setAddingUrl(null)
      if (res.error || !res.archiveItemId || !res.collectionItemId || !res.track) {
        setError(res.error ?? 'Failed to add track')
        return
      }
      setAddedUrls((prev) => new Set(prev).add(track.url))
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
        className="spotify-import-modal mixcloud-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Mixcloud track"
      >
        <div className="spotify-import-modal__header">
          <div>
            <h2 className="spotify-import-modal__title">
              Add Mixcloud track to &ldquo;{collectionTitle}&rdquo;
            </h2>
            <p className="spotify-import-modal__subline">
              these will play via Mixcloud&rsquo;s embed · not Tahti&rsquo;s FLAC
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

        <div className="spotify-import-modal__banner mixcloud-import-modal__banner" role="note">
          <strong>Honest about quality.</strong> Mixcloud tracks render as embedded players in your
          collection, not Tahti&rsquo;s FLAC stream. Best for compilations with collaborators&rsquo;
          mixes — not for your own work you have masters of.
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
            Search Mixcloud
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
            placeholder="Search Mixcloud's catalogue…"
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
              placeholder="https://www.mixcloud.com/username/…"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
            />
            <button type="submit" className="ui-btn ui-btn--sm ui-btn--primary">
              <ButtonIcon name="search" />
              Find tracks
            </button>
          </form>
        ) : null}

        {tab === 'mine' && !loading && myUsername == null ? (
          <p className="studio-text-muted-sm spotify-import-modal__hint">
            We don&rsquo;t have your Mixcloud handle yet — paste your own Mixcloud profile URL in
            &ldquo;By profile URL&rdquo; for now.
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
                const cover = mixcloudCoverProxySrc(track.coverUrl)
                const added = addedUrls.has(track.url)
                return (
                  <li key={track.url} className="spotify-import-modal__row">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="spotify-import-modal__cover" />
                    ) : (
                      <div className="spotify-import-modal__cover spotify-import-modal__cover--ph" />
                    )}
                    <div className="spotify-import-modal__row-info">
                      <div className="spotify-import-modal__row-title">{track.title}</div>
                      <div className="spotify-import-modal__row-meta">{track.displayName}</div>
                    </div>
                    <span className="spotify-import-modal__duration">
                      {formatDuration(track.durationSec)}
                    </span>
                    <button
                      type="button"
                      className="ui-btn ui-btn--sm ui-btn--primary"
                      disabled={added || addingUrl === track.url}
                      onClick={() => void handleAdd(track)}
                    >
                      {added ? '✓ Added' : addingUrl === track.url ? 'Adding…' : '+ Add'}
                    </button>
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
