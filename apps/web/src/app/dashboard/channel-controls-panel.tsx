'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Panel } from '@tahti/ui'
import { channelPlaylistLabel } from './channel-controls-label'
import { ChevronIcon } from './channel-controls-icons'
import {
  ChannelControlsPlaylistConfirm,
  ChannelControlsPlaylistSection,
} from './channel-controls-playlist-section'
import { ChannelControlsTransportBar } from './channel-controls-transport-bar'
import type {
  CollectionDetail,
  NowPlaying,
  PlaylistOption,
  Programme,
  ProgrammeItem,
} from './channel-controls-types'
import { formatRemaining } from './channel-controls-utils'
import { resolveClientApiUrl } from '@/lib/api-url'

const API_URL = resolveClientApiUrl()

export function ChannelControlsPanel({
  slug,
  title = 'Channel controls',
  description = 'Control the 24/7 artist channel without leaving your panel.',
  defaultCollapsed = false,
}: {
  slug: string
  title?: string
  description?: string
  defaultCollapsed?: boolean
}) {
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
  const [expanded, setExpanded] = useState(false)
  const [pendingChoice, setPendingChoice] = useState<{ id: string; name: string } | null>(null)
  const [managerExpanded, setManagerExpanded] = useState(!defaultCollapsed)
  const playlistSectionId = useId()
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
  const playlistLabel = channelPlaylistLabel(playlists)
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

  async function replacePlaylist(collectionId: string) {
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

  /** Merges the chosen playlist's tracks onto the end of the current custom
   * rotation instead of replacing it — only archive-item tracks carry over
   * (the fallback rotation is archive-item based; release-only collection
   * rows have nothing to append). Clears any active single-collection source
   * first, since appending only makes sense against the custom rotation. */
  async function appendPlaylist(collectionId: string) {
    setPending('playlist')
    setError(null)
    setMessage(null)
    try {
      const selected = playlists.find((playlist) => playlist.id === collectionId)
      if (!selected) throw new Error()
      const response = await fetch(
        `${API_URL}/api/me/collections/${encodeURIComponent(selected.slug)}`,
        { credentials: 'include', cache: 'no-store' },
      )
      if (!response.ok) throw new Error()
      const detail = (await response.json()) as CollectionDetail
      const newIds = new Set(rotationItems.map((item) => item.id))
      const additions = detail.items
        .map((item) => item.sound)
        .filter((item): item is { id: string; title: string } => item != null)
        .filter((item) => !newIds.has(item.id))

      if (activePlaylist) {
        const clearResponse = await fetch(
          `${API_URL}/api/channels/${encodeURIComponent(slug)}/fallback-collection`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionId: null }),
          },
        )
        if (!clearResponse.ok) throw new Error()
        setPlaylists((current) => current.map((playlist) => ({ ...playlist, active: false })))
        setCollection(null)
      }

      const mergedTitles = new Map(rotationItems.map((item) => [item.id, item.title]))
      for (const item of additions) mergedTitles.set(item.id, item.title)
      const mergedIds = [...rotationItems.map((item) => item.id), ...additions.map((i) => i.id)]

      const programmeResponse = await fetch(`${API_URL}/api/me/channel/programme`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackMode: 'ordered',
          items: mergedIds.map((soundId, index) => ({
            soundId,
            isFallback: true,
            fallbackOrder: index,
          })),
        }),
      })
      if (!programmeResponse.ok) throw new Error()
      setProgramme((await programmeResponse.json()) as Programme)
      setMessage(
        additions.length > 0
          ? `Added ${additions.length} track${additions.length === 1 ? '' : 's'} from ${selected.name}.`
          : `${selected.name} had no new tracks to add.`,
      )
    } catch {
      setError('Could not append that playlist')
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
            soundId: item.id,
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

  async function reorderCollection(next: CollectionDetail['items']) {
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

  const statusText = switchingTrack
    ? 'Switching track…'
    : nowPlaying
      ? `${nowPlaying.title} — ${nowPlaying.artistName}${
          remainingSec != null ? ` · ${formatRemaining(remainingSec)} left` : ''
        }`
      : programme?.fallbackEnabled
        ? 'Channel rotation on'
        : 'Channel stopped'

  function handlePlaylistChange(nextId: string) {
    if (!nextId) {
      void replacePlaylist('')
      return
    }
    const chosen = playlists.find((playlist) => playlist.id === nextId)
    if (chosen) setPendingChoice({ id: chosen.id, name: chosen.name })
  }

  if (!managerExpanded) {
    return (
      <div className="db-channel-controls db-channel-controls--collapsed">
        <strong className="db-channel-controls__collapsed-title">{title}</strong>
        <span className="db-channel-controls__collapsed-playlist" title={playlistLabel}>
          {playlistLabel}
        </span>
        <span className="db-channel-controls__now-compact" title={statusText}>
          {statusText}
        </span>
        <ChannelControlsTransportBar
          programme={programme}
          pending={pending}
          onTransport={(action) => void transport(action)}
          onToggleChannel={() => void toggleChannel()}
        />
        <button
          type="button"
          className="db-channel-controls__expand-toggle"
          aria-expanded="false"
          aria-label={`Expand ${title}`}
          title={`Expand ${title}`}
          onClick={() => setManagerExpanded(true)}
        >
          <ChevronIcon expanded={false} />
        </button>
      </div>
    )
  }

  return (
    <Panel title={title} headerTight description={description}>
      <div className="db-channel-controls__manager-collapse">
        <button
          type="button"
          className="db-channel-controls__manager-collapse-button db-channel-controls__manager-collapse-button--icon"
          aria-expanded="true"
          aria-label={`Collapse ${title}`}
          title={`Collapse ${title}`}
          onClick={() => setManagerExpanded(false)}
        >
          <ChevronIcon expanded />
        </button>
      </div>
      <div className="db-channel-controls__row">
        <span className="signal-dot" aria-hidden />
        <span className="db-channel-controls__now-compact" title={statusText}>
          {statusText}
        </span>
        <ChannelControlsTransportBar
          programme={programme}
          pending={pending}
          onTransport={(action) => void transport(action)}
          onToggleChannel={() => void toggleChannel()}
        />
        <button
          type="button"
          className="db-channel-controls__expand-toggle"
          aria-expanded={expanded}
          aria-controls={playlistSectionId}
          aria-label={expanded ? 'Hide playlist' : 'Show playlist'}
          title={expanded ? 'Hide playlist' : 'Show playlist'}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronIcon expanded={expanded} />
        </button>
      </div>

      {expanded && (
        <ChannelControlsPlaylistSection
          playlistSectionId={playlistSectionId}
          playlists={playlists}
          activePlaylist={activePlaylist}
          rotationItems={rotationItems}
          collection={collection}
          editableItems={editableItems}
          pending={pending}
          onPlaylistChange={handlePlaylistChange}
          onReorderCollection={(next) => void reorderCollection(next)}
          onReorderDefault={(next) => void reorderDefault(next)}
        />
      )}
      {message ? <p className="studio-text-success studio-text-sm">{message}</p> : null}
      {error ? <p className="studio-text-error studio-text-sm">{error}</p> : null}
      {pendingChoice && (
        <ChannelControlsPlaylistConfirm
          pendingChoice={pendingChoice}
          onReplace={(id) => {
            setPendingChoice(null)
            void replacePlaylist(id)
          }}
          onAppend={(id) => {
            setPendingChoice(null)
            void appendPlaylist(id)
          }}
          onCancel={() => setPendingChoice(null)}
        />
      )}
    </Panel>
  )
}
