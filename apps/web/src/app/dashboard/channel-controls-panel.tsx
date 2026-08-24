'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Panel, SortableList } from '@tahti/ui'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type ProgrammeItem = {
  id: string
  title: string
  isFallback: boolean
  fallbackOrder: number | null
}

type Programme = {
  fallbackMode: 'shuffle' | 'ordered' | 'time' | 'name'
  fallbackEnabled: boolean
  fallbackAutoEnroll: boolean
  announcementsEnabled: boolean
  items: ProgrammeItem[]
}

type PlaylistOption = {
  id: string
  slug: string
  name: string
  trackCount: number
  active: boolean
}

type CollectionItem = {
  id: string
  position: number
  archiveItem: { title: string } | null
  release: { title: string } | null
}

type CollectionDetail = {
  slug: string
  name: string
  items: CollectionItem[]
}

function itemTitle(item: CollectionItem): string {
  return item.archiveItem?.title ?? item.release?.title ?? 'Untitled track'
}

function TransportIcon({ direction }: { direction: 'previous' | 'next' }) {
  return direction === 'previous' ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 6h2v12H6zm3.5 6 9-6v12z" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M16 6h2v12h-2zM5.5 6l9 6-9 6z" fill="currentColor" />
    </svg>
  )
}

type NowPlaying = {
  title: string
  artistName: string
  durationSec: number | null
  startedAt: string
}

function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

export function ChannelControlsPanel({ slug }: { slug: string }) {
  const [programme, setProgramme] = useState<Programme | null>(null)
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([])
  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  // True right after a transport action, until the poller actually observes
  // a different track — skip/previous act on Liquidsoap directly, but
  // nowPlaying only reflects the ~20s orchestrator poller sync, so the old
  // title would otherwise sit there looking unchanged/broken for up to 20s.
  const [switchingTrack, setSwitchingTrack] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  // Ticks once a second while a track with a known duration is playing, purely
  // to force the remaining-time display to re-render — see remainingSec below.
  const [, setClockTick] = useState(0)

  const loadCollection = useCallback(async (playlistSlug: string) => {
    const response = await fetch(
      `${API_URL}/api/me/collections/${encodeURIComponent(playlistSlug)}`,
      { credentials: 'include', cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Could not load playlist tracks')
    setCollection((await response.json()) as CollectionDetail)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [programmeResponse, playlistsResponse] = await Promise.all([
          fetch(`${API_URL}/api/me/channel/programme`, {
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch(`${API_URL}/api/channels/${encodeURIComponent(slug)}/fallback-collections`, {
            credentials: 'include',
            cache: 'no-store',
          }),
        ])
        if (!programmeResponse.ok || !playlistsResponse.ok) throw new Error('Load failed')
        const nextProgramme = (await programmeResponse.json()) as Programme
        const nextPlaylists = (await playlistsResponse.json()) as PlaylistOption[]
        if (cancelled) return
        setProgramme(nextProgramme)
        setPlaylists(nextPlaylists)
        const active = nextPlaylists.find((playlist) => playlist.active)
        if (active) await loadCollection(active.slug)
      } catch {
        if (!cancelled) setError('Could not load channel controls')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [loadCollection, slug])

  const fetchNowPlaying = useCallback(async (): Promise<NowPlaying | null> => {
    const response = await fetch(`${API_URL}/api/channels/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error()
    const data = (await response.json()) as { nowPlaying: NowPlaying | null }
    return data.nowPlaying
  }, [slug])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const next = await fetchNowPlaying()
        if (!cancelled) setNowPlaying(next)
      } catch {
        // Keep the last known track; transport controls remain usable.
      }
    }
    void poll()
    const timer = setInterval(poll, 15_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [fetchNowPlaying])

  // Only ticking while there's a duration to count down — no point re-rendering
  // once a second for a channel with nothing (or a duration-less item) playing.
  useEffect(() => {
    if (nowPlaying?.durationSec == null) return
    const timer = setInterval(() => setClockTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [nowPlaying?.durationSec, nowPlaying?.startedAt])

  const remainingSec =
    nowPlaying?.durationSec != null
      ? nowPlaying.durationSec - (Date.now() - new Date(nowPlaying.startedAt).getTime()) / 1000
      : null

  const activePlaylist = playlists.find((playlist) => playlist.active) ?? null
  const rotationItems = useMemo(
    () => programme?.items.filter((item) => item.isFallback) ?? [],
    [programme],
  )

  // Skip/previous act on Liquidsoap directly, but nowPlaying only reflects the
  // orchestrator's ~20s poller sync — poll faster for a short window right
  // after a transport action instead of leaving the pre-change track sitting
  // there looking unchanged (indistinguishable from "broken") for up to 20s.
  async function pollUntilTrackChanges(previousTitle: string | undefined) {
    setSwitchingTrack(true)
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      try {
        const next = await fetchNowPlaying()
        if (next?.title !== previousTitle) {
          setNowPlaying(next)
          break
        }
      } catch {
        // Try again next attempt; give up silently after the loop ends.
      }
    }
    setSwitchingTrack(false)
  }

  async function transport(action: 'previous' | 'skip') {
    setPending(action)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch(
        `${API_URL}/api/channels/${encodeURIComponent(slug)}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )
      if (!response.ok) throw new Error()
      setMessage(action === 'skip' ? 'Playing the next track.' : 'Playing the previous track.')
      void pollUntilTrackChanges(nowPlaying?.title)
    } catch {
      setError('Could not change track. The channel may not be running yet.')
    } finally {
      setPending(null)
    }
  }

  async function toggleChannel() {
    if (!programme) return
    const enabled = !programme.fallbackEnabled
    setPending('toggle')
    setError(null)
    setMessage(null)
    try {
      const [programmeResponse, transportResponse] = await Promise.all([
        fetch(`${API_URL}/api/me/channel/programme`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fallbackEnabled: enabled }),
        }),
        fetch(
          `${API_URL}/api/channels/${encodeURIComponent(slug)}/${enabled ? 'resume' : 'pause'}`,
          { method: 'POST', credentials: 'include' },
        ),
      ])
      if (!programmeResponse.ok) throw new Error()
      setProgramme((await programmeResponse.json()) as Programme)
      setMessage(enabled ? 'Channel rotation started.' : 'Channel rotation stopped.')
      if (!transportResponse.ok && transportResponse.status !== 409) {
        setMessage(
          enabled ? 'Rotation enabled; it will start with the channel.' : 'Rotation disabled.',
        )
      }
    } catch {
      setError('Could not update the channel state')
    } finally {
      setPending(null)
    }
  }

  async function switchPlaylist(collectionId: string) {
    setPending('playlist')
    setError(null)
    setMessage(null)
    try {
      const selected = playlists.find((playlist) => playlist.id === collectionId) ?? null
      const response = await fetch(
        `${API_URL}/api/channels/${encodeURIComponent(slug)}/fallback-collection`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionId: selected?.id ?? null }),
        },
      )
      if (!response.ok) throw new Error()
      setPlaylists((current) =>
        current.map((playlist) => ({ ...playlist, active: playlist.id === selected?.id })),
      )
      if (selected) await loadCollection(selected.slug)
      else setCollection(null)
      setMessage(`Playlist changed to ${selected?.name ?? 'Default rotation'}.`)
    } catch {
      setError('Could not change the channel playlist')
    } finally {
      setPending(null)
    }
  }

  async function reorderDefault(next: ProgrammeItem[]) {
    if (!programme) return
    const previous = programme
    const positions = new Map(next.map((item, index) => [item.id, index]))
    const optimistic = {
      ...programme,
      fallbackMode: 'ordered' as const,
      items: programme.items.map((item) => ({
        ...item,
        fallbackOrder: item.isFallback ? (positions.get(item.id) ?? null) : item.fallbackOrder,
      })),
    }
    setProgramme(optimistic)
    setPending('reorder')
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/me/channel/programme`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackMode: 'ordered',
          items: optimistic.items.map((item) => ({
            archiveItemId: item.id,
            isFallback: item.isFallback,
            ...(item.isFallback && item.fallbackOrder != null
              ? { fallbackOrder: item.fallbackOrder }
              : {}),
          })),
        }),
      })
      if (!response.ok) throw new Error()
      setProgramme((await response.json()) as Programme)
      setMessage('Play order saved.')
    } catch {
      setProgramme(previous)
      setError('Could not save the new play order')
    } finally {
      setPending(null)
    }
  }

  async function reorderCollection(next: CollectionItem[]) {
    if (!collection) return
    const previous = collection.items
    setCollection({ ...collection, items: next })
    setPending('reorder')
    setError(null)
    try {
      const response = await fetch(
        `${API_URL}/api/me/collections/${encodeURIComponent(collection.slug)}/reorder`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: next.map((item) => item.id) }),
        },
      )
      if (!response.ok) throw new Error()
      setMessage('Playlist order saved.')
    } catch {
      setCollection({ ...collection, items: previous })
      setError('Could not save the new playlist order')
    } finally {
      setPending(null)
    }
  }

  const editableItems = activePlaylist ? (collection?.items ?? []) : rotationItems

  return (
    <Panel
      title="Channel controls"
      headerTight
      description="Control the 24/7 artist channel without leaving your panel."
    >
      <div className="db-channel-controls__now">
        <span className="signal-dot" aria-hidden />
        <span className="db-channel-controls__status">
          {programme?.fallbackEnabled ? 'Channel rotation on' : 'Channel stopped'}
        </span>
        {nowPlaying && (
          <span className="db-channel-controls__track-info">
            <span className="db-channel-controls__track-title">{nowPlaying.title}</span>
            <span className="db-channel-controls__track-artist">{nowPlaying.artistName}</span>
            {remainingSec != null && (
              <span className="db-channel-controls__track-remaining">
                {formatRemaining(remainingSec)} left
              </span>
            )}
          </span>
        )}
        {switchingTrack && (
          <span className="db-channel-controls__switching">Switching track…</span>
        )}
      </div>

      <div className="db-channel-controls__transport" role="group" aria-label="Channel playback">
        <Button
          type="button"
          variant="secondary"
          aria-label="Previous track"
          title="Previous track"
          disabled={pending !== null}
          onClick={() => void transport('previous')}
        >
          <TransportIcon direction="previous" />
        </Button>
        <Button
          type="button"
          variant={programme?.fallbackEnabled ? 'danger' : 'primary'}
          disabled={!programme || pending !== null}
          onClick={() => void toggleChannel()}
        >
          {programme?.fallbackEnabled ? 'Stop channel' : 'Start channel'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-label="Next track"
          title="Next track"
          disabled={pending !== null}
          onClick={() => void transport('skip')}
        >
          <TransportIcon direction="next" />
        </Button>
      </div>

      <label className="studio-label" htmlFor="dashboard-channel-playlist">
        Channel playlist
      </label>
      <select
        id="dashboard-channel-playlist"
        className="studio-input db-channel-controls__select"
        value={activePlaylist?.id ?? ''}
        disabled={pending !== null}
        onChange={(event) => void switchPlaylist(event.target.value)}
      >
        <option value="">Default rotation ({rotationItems.length})</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.name} ({playlist.trackCount})
          </option>
        ))}
      </select>

      <div className="db-channel-controls__playlist-head">
        <strong>{activePlaylist?.name ?? 'Default rotation'}</strong>
        <a href="/dashboard/channel/playlist" className="studio-link">
          Edit full playlist
        </a>
      </div>
      {editableItems.length === 0 ? (
        <p className="studio-text-muted-sm studio-m-0">This playlist has no tracks yet.</p>
      ) : activePlaylist ? (
        <SortableList
          as="ol"
          className="db-channel-controls__playlist"
          items={collection?.items ?? []}
          itemId={(item) => item.id}
          onReorder={(next) => void reorderCollection(next)}
          renderItem={(item, index, sortable) => (
            <li
              ref={sortable.ref}
              className={`db-channel-controls__track${sortable.isDragging ? ' is-dragging' : ''}`}
            >
              <button
                ref={sortable.handleRef}
                type="button"
                aria-label={`Reorder ${itemTitle(item)}`}
              >
                ⠿
              </button>
              <span>{index + 1}</span>
              <strong>{itemTitle(item)}</strong>
            </li>
          )}
        />
      ) : (
        <SortableList
          as="ol"
          className="db-channel-controls__playlist"
          items={rotationItems}
          itemId={(item) => item.id}
          onReorder={(next) => void reorderDefault(next)}
          renderItem={(item, index, sortable) => (
            <li
              ref={sortable.ref}
              className={`db-channel-controls__track${sortable.isDragging ? ' is-dragging' : ''}`}
            >
              <button ref={sortable.handleRef} type="button" aria-label={`Reorder ${item.title}`}>
                ⠿
              </button>
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
            </li>
          )}
        />
      )}
      {pending === 'reorder' ? <p className="studio-text-muted-sm">Saving order…</p> : null}
      {message ? <p className="studio-text-success studio-text-sm">{message}</p> : null}
      {error ? <p className="studio-text-error studio-text-sm">{error}</p> : null}
    </Panel>
  )
}
