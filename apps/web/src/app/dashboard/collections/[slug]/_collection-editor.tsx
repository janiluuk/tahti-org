// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ButtonIcon, Button, SortableList } from '@tahti/ui'
import type { SoundSource, SoundQualityBadge } from '@tahti/shared'
import { QUALITY_BADGE_LABEL } from '@tahti/shared'
import { CoverImageUpload } from '@/components/cover-image-upload'
import { LibraryBrowser } from '@/components/library/library-browser'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { useToast } from '@/contexts/toast-context'
import {
  updateCollection,
  reorderCollectionItems,
  deleteCollection,
  addCollectionItem,
  prepareCollectionCoverUpload,
  completeCollectionCoverUpload,
  fetchCollectionCoverFromUrl,
} from '../../collection-actions'
import { STYLE_LABEL, STYLE_COLOR } from '../collection-labels'
import { CollectionEmbedButton } from '../_collection-embed-button'
import { SpotifyImportModal, spotifyCoverProxySrc } from './_spotify-import-modal'
import { MixcloudImportModal, mixcloudCoverProxySrc } from './_mixcloud-import-modal'
import { HearthisImportModal } from './_hearthis-import-modal'
import { listMyIntegrations } from '../../integrations-actions'
import { MixcloudEmbedRow } from '../../../u/[username]/c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from '../../../u/[username]/c/[slug]/_spotify-embed-row'

const SOURCE_BADGE_LABEL: Partial<Record<SoundSource, string>> = {
  SPOTIFY_EMBED: 'SPOTIFY EMBED',
  MIXCLOUD_EMBED: 'MIXCLOUD EMBED',
  HEARTHIS_EMBED: 'HEARTHIS EMBED',
  URL_EMBED: 'EMBED',
}

const SOURCE_BADGE_CLASS: Partial<Record<SoundSource, string>> = {
  SPOTIFY_EMBED: 'collection-tracklist__badge--spotify',
  MIXCLOUD_EMBED: 'collection-tracklist__badge--mixcloud',
  HEARTHIS_EMBED: 'collection-tracklist__badge--hearthis',
  URL_EMBED: 'collection-tracklist__badge--embed',
}

const QUALITY_BADGE_CLASS: Record<SoundQualityBadge, string> = {
  LOSSLESS: '',
  TRANSCODED: 'collection-tracklist__badge--transcoded',
  EMBED_ONLY: 'collection-tracklist__badge--embed',
}

interface CollectionItem {
  id: string
  position: number
  audioUrl?: string | null
  sound: {
    id: string
    title: string
    durationSec: number | null
    bannerUrl: string | null
    createdAt: string
    source: SoundSource
    qualityBadge: SoundQualityBadge
    embedProvider?: string | null
    embedUri?: string | null
  } | null
  release: {
    id: string
    title: string
    type: string
    smartLinkSlug: string
    artworkUrl: string | null
    releaseDate?: string | null
  } | null
}

interface CollectionDetail {
  id: string
  slug: string
  name: string
  description: string | null
  type: string
  style: string
  trackSortMode: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  isPublic: boolean
  isFeatured: boolean
  collaborative: boolean
  items: CollectionItem[]
}

const SORT_MODE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual (drag to reorder)' },
  { value: 'TIME', label: 'By time added' },
  { value: 'NAME', label: 'By name' },
]

const STYLE_OPTIONS = ['PLAYLIST', 'ALBUM', 'EP', 'SINGLE', 'DJ_SET_SERIES', 'PODCAST']

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function itemTitle(item: CollectionItem): string {
  return item.sound?.title ?? item.release?.title ?? '—'
}

function itemThumb(item: CollectionItem): string | null {
  const bannerUrl = item.sound?.bannerUrl ?? null
  if (bannerUrl && item.sound?.source === 'SPOTIFY_EMBED') {
    return spotifyCoverProxySrc(bannerUrl)
  }
  if (bannerUrl && item.sound?.source === 'MIXCLOUD_EMBED') {
    return mixcloudCoverProxySrc(bannerUrl)
  }
  return bannerUrl ?? item.release?.artworkUrl ?? null
}

export function CollectionEditor({
  collection: initial,
  mySoundItems = [],
  myReleases = [],
}: {
  collection: CollectionDetail
  mySoundItems?: Array<{ id: string; title: string; status: string }>
  myReleases?: Array<{ id: string; title: string; state: string }>
}) {
  const router = useRouter()
  const { track, playing, load, togglePlay, addToQueue } = usePlayer()
  const { showToast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Settings state
  const [name, setName] = useState(initial.name)
  const [style, setStyle] = useState(initial.style)
  const [trackSortMode, setTrackSortMode] = useState(initial.trackSortMode)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured)
  const [collaborative, setCollaborative] = useState(initial.collaborative)
  const [description, setDescription] = useState(initial.description ?? '')
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Tracklist state
  const [items, setItems] = useState(initial.items)
  const [reorderSaving, setReorderSaving] = useState(false)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false)
  const [mixcloudModalOpen, setMixcloudModalOpen] = useState(false)
  const [hearthisModalOpen, setHearthisModalOpen] = useState(false)
  // Which row's embed player (Hearthis/Mixcloud/Spotify — no audio file of
  // their own, so no shared-mini-player playback) is currently expanded.
  const [expandedEmbedItemId, setExpandedEmbedItemId] = useState<string | null>(null)
  // null = still loading — fail open so the buttons aren't stuck disabled if this is slow.
  const [installedProviders, setInstalledProviders] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let cancelled = false
    void listMyIntegrations().then((result) => {
      if (cancelled) return
      const map: Record<string, boolean> = {}
      for (const i of result.integrations) map[i.slug] = i.installed || i.connected
      setInstalledProviders(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isProviderReady = useCallback(
    (slug: string) => installedProviders === null || (installedProviders[slug] ?? true),
    [installedProviders],
  )
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [libraryPick, setLibraryPick] = useState('')
  const [libraryAdding, setLibraryAdding] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // View vs edit: opening a collection shows its info + tracklist read-only;
  // the settings form (name/style/cover/visibility/etc.) only mounts on request.
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  const totalDurationSec = useMemo(
    () => items.reduce((sum, item) => sum + (item.sound?.durationSec ?? 0), 0),
    [items],
  )

  const markDirty = useCallback(() => {
    setSettingsDirty(true)
    setSettingsSaved(false)
  }, [])

  const saveSettings = useCallback(async () => {
    setSettingsSaving(true)
    setSettingsError(null)
    const { error } = await updateCollection(initial.slug, {
      isPublic,
      isFeatured,
      collaborative: isPublic && style === 'PLAYLIST' ? collaborative : false,
      style,
      trackSortMode,
      description: description.trim() || null,
    })
    setSettingsSaving(false)
    if (error) {
      setSettingsError(error)
    } else {
      setSettingsDirty(false)
      setSettingsSaved(true)
      startTransition(() => router.refresh())
    }
  }, [initial.slug, isPublic, isFeatured, collaborative, style, trackSortMode, description, router])

  const persistItemOrder = useCallback(
    async (previous: CollectionItem[], ordered: CollectionItem[]) => {
      setReorderSaving(true)
      const { error } = await reorderCollectionItems(
        initial.slug,
        ordered.map((i) => i.id),
      ).catch(() => ({ error: 'Could not save the new track order — please try again.' }))
      setReorderSaving(false)
      if (error) {
        setItems(previous)
        setReorderError(error)
      } else {
        setReorderError(null)
      }
    },
    [initial.slug],
  )

  const handleReorderItems = useCallback(
    (next: CollectionItem[]) => {
      const previous = items
      const reindexed = next.map((item, i) => ({ ...item, position: i + 1 }))
      setItems(reindexed)
      void persistItemOrder(previous, reindexed)
    },
    [items, persistItemOrder],
  )

  // Manual drag-reorder only takes effect on the public page when the collection's
  // saved sort mode is MANUAL — other modes recompute display order server-side, so
  // dragging would silently do nothing (UX sweep, 2026-07-22).
  const canManualReorder = initial.trackSortMode === 'MANUAL'
  const displayItems = useMemo(() => {
    if (canManualReorder) return items
    if (initial.trackSortMode === 'NAME') {
      return [...items].sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)))
    }
    if (initial.trackSortMode === 'TIME') {
      return [...items].sort((a, b) => {
        const at = a.sound?.createdAt ?? a.release?.releaseDate ?? ''
        const bt = b.sound?.createdAt ?? b.release?.releaseDate ?? ''
        return at.localeCompare(bt)
      })
    }
    return items
  }, [items, canManualReorder, initial.trackSortMode])

  const playbackQueue = useMemo(
    () =>
      displayItems.flatMap((item) =>
        item.audioUrl || (item.sound?.source === 'HEARTHIS_EMBED' && item.sound.embedUri)
          ? [toPlayerTrack(item)]
          : [],
      ),
    [displayItems],
  )

  const currentTrackInQueue = playbackQueue.find((t) => t.id === track?.id)
  const isPlayingCollection = Boolean(currentTrackInQueue) && playing
  const playCollection = useCallback(() => {
    if (playbackQueue.length === 0) return
    if (currentTrackInQueue) {
      void togglePlay()
      return
    }
    load(playbackQueue[0]!, { autoplay: true, queue: playbackQueue })
  }, [playbackQueue, currentTrackInQueue, togglePlay, load])

  const toggleItemPlayback = useCallback(
    async (item: CollectionItem) => {
      if (!item.audioUrl && !(item.sound?.source === 'HEARTHIS_EMBED' && item.sound.embedUri))
        return
      const playerTrack = toPlayerTrack(item)
      if (track?.id === playerTrack.id) {
        await togglePlay()
        return
      }
      load(playerTrack, { autoplay: true, queue: playbackQueue })
    },
    [track, togglePlay, load, playbackQueue],
  )

  const queueItem = useCallback(
    (item: CollectionItem) => {
      const isHearthis = item.sound?.source === 'HEARTHIS_EMBED' && Boolean(item.sound.embedUri)
      if (!item.audioUrl && !isHearthis) return
      const added = addToQueue(toPlayerTrack(item))
      const title = itemTitle(item)
      showToast(
        added ? `Added “${title}” to the queue.` : `“${title}” is already in the queue.`,
        added ? 'success' : 'info',
      )
    },
    [addToQueue, showToast],
  )

  const addFromLibrary = useCallback(
    async (selectedPick = libraryPick) => {
      if (!selectedPick) return
      setLibraryAdding(true)
      setLibraryError(null)
      const [kind, id] = selectedPick.split(':')
      const { error } = await addCollectionItem(
        initial.slug,
        kind === 'sound' ? { soundId: id } : { releaseId: id },
      )
      setLibraryAdding(false)
      if (error) {
        setLibraryError(error)
        return
      }
      setLibraryPick('')
      setLibraryPickerOpen(false)
      startTransition(() => router.refresh())
    },
    [initial.slug, libraryPick, router],
  )

  const usedSoundIds = new Set(items.map((i) => i.sound?.id).filter(Boolean))
  const usedReleaseIds = new Set(items.map((i) => i.release?.id).filter(Boolean))
  const availableSoundItems = mySoundItems.filter(
    (a) => a.status === 'READY' && !usedSoundIds.has(a.id),
  )
  const availableReleases = myReleases.filter((r) => !usedReleaseIds.has(r.id))
  const availableLibraryItems = useMemo(
    () => [
      ...availableSoundItems.map((item) => ({ ...item, kind: 'sound' as const })),
      ...availableReleases.map((item) => ({ ...item, kind: 'release' as const })),
    ],
    [availableSoundItems, availableReleases],
  )

  const renderTrackRowBody = useCallback(
    (item: CollectionItem, idx: number) => {
      const thumb = itemThumb(item)
      const title = itemTitle(item)
      const dur = item.sound?.durationSec
      const source = item.sound?.source
      const quality = item.sound?.qualityBadge
      const badgeLabel =
        (source ? SOURCE_BADGE_LABEL[source] : undefined) ??
        (quality ? QUALITY_BADGE_LABEL[quality] : undefined)
      const badgeClass =
        (source ? SOURCE_BADGE_CLASS[source] : undefined) ??
        (quality ? QUALITY_BADGE_CLASS[quality] : undefined)
      const embedUri = item.sound?.embedUri
      const embedProvider = item.sound?.embedProvider
      const isEmbedExpanded = expandedEmbedItemId === item.id
      return (
        <>
          <span className="collection-tracklist__pos">{idx + 1}</span>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="collection-tracklist__thumb" />
          ) : (
            <div className="collection-tracklist__thumb collection-tracklist__thumb--ph" />
          )}
          <span className="collection-tracklist__title">{title}</span>
          {item.audioUrl ? (
            <span className="collection-tracklist__playback">
              <button
                type="button"
                onClick={() => void toggleItemPlayback(item)}
                title={track?.id === toPlayerTrack(item).id && playing ? 'Pause' : 'Play'}
                aria-label={
                  track?.id === toPlayerTrack(item).id && playing
                    ? `Pause ${title}`
                    : `Play ${title}`
                }
              >
                {track?.id === toPlayerTrack(item).id && playing ? '❚❚' : '▶'}
              </button>
              <button
                type="button"
                onClick={() => queueItem(item)}
                title="Add to queue"
                aria-label={`Add ${title} to queue`}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2.5 4h11M2.5 8h11M2.5 12h7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 10.5v4M10 12.5h4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ) : embedUri ? (
            <span className="collection-tracklist__playback">
              <button
                type="button"
                onClick={() =>
                  embedProvider === 'HEARTHIS'
                    ? void toggleItemPlayback(item)
                    : setExpandedEmbedItemId(isEmbedExpanded ? null : item.id)
                }
                title={
                  embedProvider === 'HEARTHIS' ? 'Play' : isEmbedExpanded ? 'Hide player' : 'Play'
                }
                aria-label={
                  embedProvider === 'HEARTHIS'
                    ? `Play ${title}`
                    : isEmbedExpanded
                      ? `Hide ${title} player`
                      : `Play ${title}`
                }
                aria-expanded={embedProvider === 'HEARTHIS' ? undefined : isEmbedExpanded}
              >
                {embedProvider === 'HEARTHIS' && track?.id === toPlayerTrack(item).id && playing
                  ? '❚❚'
                  : isEmbedExpanded
                    ? '❚❚'
                    : '▶'}
              </button>
              {embedProvider === 'HEARTHIS' && (
                <button
                  type="button"
                  onClick={() => queueItem(item)}
                  title="Add to queue"
                  aria-label={`Add ${title} to queue`}
                >
                  +
                </button>
              )}
            </span>
          ) : null}
          {badgeLabel ? (
            <span className={`collection-tracklist__badge ${badgeClass ?? ''}`}>{badgeLabel}</span>
          ) : null}
          {dur != null && <span className="collection-tracklist__dur">{formatDuration(dur)}</span>}
          {isEmbedExpanded && embedUri && embedProvider !== 'HEARTHIS' && (
            <ul className="collection-tracklist__embed">
              {embedProvider === 'MIXCLOUD' ? (
                <MixcloudEmbedRow title={title} embedUri={embedUri} />
              ) : embedProvider === 'SPOTIFY' ? (
                <SpotifyEmbedRow title={title} embedUri={embedUri} />
              ) : null}
            </ul>
          )}
          {reorderSaving && (
            <span className="collection-tracklist__saving" aria-hidden>
              …
            </span>
          )}
        </>
      )
    },
    [
      playing,
      reorderSaving,
      track,
      expandedEmbedItemId,
      queueItem,
      toggleItemPlayback,
      playbackQueue,
    ],
  )

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    const { error } = await deleteCollection(initial.slug)
    if (error) {
      setDeleting(false)
      setConfirmDelete(false)
      setSettingsError(error)
    } else {
      router.push('/dashboard/collections')
    }
  }, [initial.slug, router])

  return (
    <div className="collection-editor">
      {/* Header */}
      <div className="collection-editor__header">
        <Link href="/dashboard/collections" className="collection-editor__back">
          ← Collections
        </Link>
        <h1 className="collection-editor__title">{name || initial.name}</h1>
        <span className={`collections-pill ${STYLE_COLOR[style] ?? 'collections-pill--neutral'}`}>
          {STYLE_LABEL[style] ?? style}
        </span>
        <span style={{ marginLeft: 'auto' }} className="collection-editor__header-actions">
          <CollectionEmbedButton slug={initial.slug} />
          <Button
            variant={mode === 'edit' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode((m) => (m === 'edit' ? 'view' : 'edit'))}
          >
            <ButtonIcon name={mode === 'edit' ? 'check' : 'edit'} />
            {mode === 'edit' ? 'Done' : 'Edit'}
          </Button>
        </span>
      </div>

      {mode === 'view' && (
        <div className="collection-view-hero">
          <div className="collection-view-hero__cover">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="collection-view-hero__cover-img" />
            ) : (
              <div className="collection-view-hero__cover-ph" aria-hidden />
            )}
            {playbackQueue.length > 0 && (
              <button
                type="button"
                className="collection-view-hero__play"
                onClick={playCollection}
                aria-label={isPlayingCollection ? 'Pause' : 'Play collection'}
              >
                {isPlayingCollection ? '❚❚' : '▶'}
              </button>
            )}
          </div>
          <div className="collection-view-hero__info">
            {description && <p className="collection-view-hero__desc">{description}</p>}
            <p className="collection-view-hero__meta">
              {items.length} track{items.length === 1 ? '' : 's'}
              {totalDurationSec > 0 && <> · {formatDuration(totalDurationSec)}</>}
            </p>
          </div>
        </div>
      )}

      <div
        className={`collection-editor__body${mode === 'view' ? ' collection-editor__body--view' : ''}`}
      >
        {/* ── Left: settings (edit mode only) ── */}
        {mode === 'edit' && (
          <aside className="collection-editor__settings">
            <h2 className="collection-editor__section-title">Settings</h2>

            <div className="studio-field">
              <label className="studio-label" htmlFor={`collection-name-${initial.id}`}>
                Name
              </label>
              <input
                id={`collection-name-${initial.id}`}
                className="studio-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  markDirty()
                }}
                maxLength={100}
              />
            </div>

            {(style === 'DJ_SET_SERIES' || style === 'PODCAST') && (
              <Link
                href={`/dashboard/schedule?seriesName=${encodeURIComponent(name)}&format=${style === 'PODCAST' ? 'TALK' : 'LIVE_SET'}${coverUrl ? `&artwork=${encodeURIComponent(coverUrl)}` : ''}`}
                className="ui-btn ui-btn--secondary"
              >
                <ButtonIcon name="plus" />
                Schedule next episode
              </Link>
            )}

            <div className="studio-field">
              <span className="studio-label">Style</span>
              <div className="collection-form__style-grid">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`collection-form__style-pill${
                      style === s ? ' collection-form__style-pill--active' : ''
                    }`}
                    onClick={() => {
                      setStyle(s)
                      markDirty()
                    }}
                  >
                    {STYLE_LABEL[s] ?? s}
                  </button>
                ))}
              </div>
            </div>

            <div className="studio-field">
              <label className="studio-label" htmlFor={`collection-sort-${initial.id}`}>
                Track order
              </label>
              <select
                id={`collection-sort-${initial.id}`}
                className="studio-input"
                value={trackSortMode}
                onChange={(e) => {
                  setTrackSortMode(e.target.value)
                  markDirty()
                }}
              >
                {SORT_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="studio-field">
              <CoverImageUpload
                currentUrl={coverUrl}
                label="Cover image"
                prepare={(args) => prepareCollectionCoverUpload(initial.slug, args)}
                complete={(uploadKey) => completeCollectionCoverUpload(initial.slug, uploadKey)}
                fromUrl={(sourceUrl) => fetchCollectionCoverFromUrl(initial.slug, sourceUrl)}
                onUploaded={(url) => setCoverUrl(url)}
              />
            </div>

            <fieldset className="collection-form__vis-fieldset">
              <legend className="studio-label">Visibility</legend>
              <div className="collection-form__vis-row">
                <label className="collection-form__vis-option">
                  <input
                    type="radio"
                    name={`vis-${initial.id}`}
                    checked={isPublic}
                    onChange={() => {
                      setIsPublic(true)
                      markDirty()
                    }}
                  />
                  <span className="collection-form__vis-copy">
                    <span className="collection-form__vis-label">Public</span>
                    <span className="collection-form__vis-desc">Visible on your profile</span>
                  </span>
                </label>
                <label className="collection-form__vis-option">
                  <input
                    type="radio"
                    name={`vis-${initial.id}`}
                    checked={!isPublic}
                    onChange={() => {
                      setIsPublic(false)
                      markDirty()
                    }}
                  />
                  <span className="collection-form__vis-copy">
                    <span className="collection-form__vis-label">Draft</span>
                    <span className="collection-form__vis-desc">Only you can see it</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="collection-form__vis-option collection-form__featured-row">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => {
                  setIsFeatured(e.target.checked)
                  markDirty()
                }}
              />
              <span className="collection-form__vis-label">Featured on profile</span>
            </label>

            {style === 'PLAYLIST' && (
              <label className="collection-form__vis-option collection-form__featured-row">
                <input
                  type="checkbox"
                  checked={collaborative}
                  disabled={!isPublic}
                  onChange={(e) => {
                    setCollaborative(e.target.checked)
                    markDirty()
                  }}
                />
                <span className="collection-form__vis-copy">
                  <span className="collection-form__vis-label">Collaborative playlist</span>
                  <span className="collection-form__vis-desc">
                    {isPublic
                      ? 'Any logged-in listener can add tracks from the Tahti catalog'
                      : 'Only public playlists can be collaborative'}
                  </span>
                </span>
              </label>
            )}

            <div className="studio-field">
              <label className="studio-label" htmlFor={`collection-desc-${initial.id}`}>
                Description
              </label>
              <textarea
                id={`collection-desc-${initial.id}`}
                className="studio-input collection-form__textarea"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  markDirty()
                }}
                maxLength={1000}
                rows={4}
              />
            </div>

            {settingsError && <p className="studio-text-error studio-text-sm">{settingsError}</p>}

            {settingsDirty && (
              <Button
                onClick={() => void saveSettings()}
                disabled={settingsSaving || isPending}
                variant="primary"
              >
                <ButtonIcon name="save" />
                {settingsSaving ? 'Saving…' : 'Save settings'}
              </Button>
            )}
            {settingsSaved && !settingsDirty && (
              <span className="collection-editor__saved">Saved</span>
            )}

            {/* Danger zone */}
            <div className="collection-editor__danger">
              <h3 className="collection-editor__danger-title">Danger zone</h3>
              {!confirmDelete ? (
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="ghost"
                  size="sm"
                  className="collection-editor__delete-btn"
                >
                  Delete collection
                </Button>
              ) : (
                <div className="collection-editor__confirm-delete">
                  <p>Delete &ldquo;{initial.name}&rdquo;? This removes it from all smart links.</p>
                  <div className="collection-editor__confirm-btns">
                    <Button onClick={() => setConfirmDelete(false)} variant="ghost" size="sm">
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      variant="primary"
                      className="collection-editor__delete-confirm"
                    >
                      <ButtonIcon name="trash" />
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* ── Right: tracklist ── */}
        <section className="collection-editor__tracklist">
          <div className="collection-editor__tracklist-header">
            <h2 className="collection-editor__section-title">
              Tracks &amp; releases
              <span className="collection-editor__count">{items.length}</span>
            </h2>
            {mode === 'edit' && (
              <div className="collection-editor__add-buttons">
                <Button onClick={() => setLibraryPickerOpen((v) => !v)} variant="ghost" size="sm">
                  + Tahti library
                </Button>
                <Button
                  onClick={() => setSpotifyModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="collection-editor__add-btn--spotify"
                  disabled={!isProviderReady('spotify')}
                  title={
                    isProviderReady('spotify')
                      ? undefined
                      : 'Install the Spotify integration in Settings → Integrations first'
                  }
                >
                  + Spotify
                </Button>
                <Button
                  onClick={() => setMixcloudModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="collection-editor__add-btn--mixcloud"
                  disabled={!isProviderReady('mixcloud-import')}
                  title={
                    isProviderReady('mixcloud-import')
                      ? undefined
                      : 'Install the Mixcloud integration in Settings → Integrations first'
                  }
                >
                  + Mixcloud
                </Button>
                <Button
                  onClick={() => setHearthisModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="collection-editor__add-btn--hearthis"
                  disabled={!isProviderReady('hearthis-import')}
                  title={
                    isProviderReady('hearthis-import')
                      ? undefined
                      : 'Install the hearthis.at integration in Settings → Integrations first'
                  }
                >
                  + hearthis.at
                </Button>
              </div>
            )}
            {mode === 'edit' &&
              (!isProviderReady('spotify') ||
                !isProviderReady('mixcloud-import') ||
                !isProviderReady('hearthis-import')) && (
                <p className="studio-text-muted-sm studio-mt-xs">
                  Some import sources need installing first —{' '}
                  <Link href="/dashboard/settings/integrations">Settings → Integrations</Link>.
                </p>
              )}
          </div>

          {mode === 'edit' && libraryPickerOpen ? (
            <div className="collection-editor__library-picker studio-mt-sm">
              <LibraryBrowser
                items={availableLibraryItems}
                getTitle={(item) => item.title}
                showStatusFilters={false}
                searchPlaceholder="Search your library…"
                emptyMessage="No unused library items available."
                noMatchMessage="No unused library items match."
              >
                {(visible) => (
                  <ul className="studio-list studio-mt-sm">
                    {visible.map((item) => {
                      const value = `${item.kind}:${item.id}`
                      const selected = libraryPick === value
                      return (
                        <li key={value} className="studio-programme-row">
                          <button
                            type="button"
                            className="studio-programme-label"
                            aria-pressed={selected}
                            onClick={() => setLibraryPick(selected ? '' : value)}
                          >
                            <span>{item.title}</span>
                            <span className="studio-text-muted-sm">
                              {item.kind === 'sound' ? 'Sound item' : `Release · ${item.state}`}
                            </span>
                          </button>
                          <Button
                            onClick={() => {
                              setLibraryPick(value)
                              void addFromLibrary(value)
                            }}
                            disabled={libraryAdding}
                            variant={selected ? 'primary' : 'secondary'}
                            size="sm"
                          >
                            <ButtonIcon name="plus" />
                            {libraryAdding && selected ? 'Adding…' : 'Add'}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </LibraryBrowser>
              {libraryError && <p className="studio-text-error studio-text-sm">{libraryError}</p>}
            </div>
          ) : null}

          {spotifyModalOpen ? (
            <SpotifyImportModal
              collectionId={initial.id}
              collectionTitle={name || initial.name}
              onClose={() => setSpotifyModalOpen(false)}
              onAdded={({ soundId, collectionItemId, track }) => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: collectionItemId,
                    position: prev.length + 1,
                    sound: {
                      id: soundId,
                      title: track.title,
                      durationSec: track.durationSec,
                      bannerUrl: track.coverUrl,
                      createdAt: new Date().toISOString(),
                      source: 'SPOTIFY_EMBED',
                      qualityBadge: 'EMBED_ONLY',
                    },
                    release: null,
                  },
                ])
              }}
            />
          ) : null}

          {mixcloudModalOpen ? (
            <MixcloudImportModal
              collectionId={initial.id}
              collectionTitle={name || initial.name}
              onClose={() => setMixcloudModalOpen(false)}
              onAdded={({ soundId, collectionItemId, track }) => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: collectionItemId,
                    position: prev.length + 1,
                    sound: {
                      id: soundId,
                      title: track.title,
                      durationSec: track.durationSec,
                      bannerUrl: track.coverUrl,
                      createdAt: new Date().toISOString(),
                      source: 'MIXCLOUD_EMBED',
                      qualityBadge: 'EMBED_ONLY',
                    },
                    release: null,
                  },
                ])
              }}
            />
          ) : null}

          {hearthisModalOpen ? (
            <HearthisImportModal
              collectionId={initial.id}
              collectionTitle={name || initial.name}
              onClose={() => setHearthisModalOpen(false)}
              onAdded={({ soundId, collectionItemId, track }) => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: collectionItemId,
                    position: prev.length + 1,
                    sound: {
                      id: soundId,
                      title: track.title,
                      durationSec: track.durationSec,
                      bannerUrl: track.coverUrl,
                      createdAt: new Date().toISOString(),
                      source: 'HEARTHIS_EMBED',
                      qualityBadge: 'EMBED_ONLY',
                    },
                    release: null,
                  },
                ])
              }}
            />
          ) : null}

          {!canManualReorder && (
            <p className="studio-text-muted-sm collection-editor__sort-hint">
              Track order is set to &ldquo;
              {SORT_MODE_OPTIONS.find((o) => o.value === initial.trackSortMode)?.label ??
                initial.trackSortMode}
              &rdquo; — switch Track order to Manual to drag-reorder.
            </p>
          )}
          {reorderError && <p className="studio-text-error studio-text-sm">{reorderError}</p>}

          {items.length === 0 ? (
            <div className="studio-empty-card collection-editor__empty">
              <p className="studio-empty-card__text">No items yet</p>
              <p className="studio-empty-card__hint">
                Add archive recordings or releases from your catalog tab.
              </p>
              <Link
                href="/dashboard/sounds"
                className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm"
              >
                <ButtonIcon name="link" />
                Open archive →
              </Link>
            </div>
          ) : canManualReorder ? (
            <SortableList
              as="ol"
              className="collection-tracklist"
              items={items}
              itemId={(item) => item.id}
              onReorder={handleReorderItems}
              renderItem={(item, idx, sortable) => (
                <li
                  key={item.id}
                  ref={sortable.ref}
                  className={`collection-tracklist__row${
                    sortable.isDragging ? ' collection-tracklist__row--dragging' : ''
                  }`}
                >
                  <span ref={sortable.handleRef} className="collection-tracklist__drag">
                    ⠿
                  </span>
                  {renderTrackRowBody(item, idx)}
                </li>
              )}
            />
          ) : (
            <ol className="collection-tracklist">
              {displayItems.map((item, idx) => (
                <li
                  key={item.id}
                  className="collection-tracklist__row collection-tracklist__row--static"
                >
                  <span
                    className="collection-tracklist__drag"
                    aria-hidden
                    title="Set Track order to Manual to drag-reorder"
                  >
                    ⠿
                  </span>
                  {renderTrackRowBody(item, idx)}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

function toPlayerTrack(item: CollectionItem): PlayerTrack {
  const isHearthis = item.sound?.source === 'HEARTHIS_EMBED' && item.sound.embedUri
  return {
    id: item.sound?.id ?? `collection-release-${item.release?.id ?? item.id}`,
    kind: 'sound',
    url: item.audioUrl ?? '',
    title: itemTitle(item),
    artworkUrl: itemThumb(item),
    durationSec: item.sound?.durationSec,
    ...(isHearthis
      ? { embed: { provider: 'HEARTHIS' as const, embedUri: item.sound!.embedUri! } }
      : {}),
  }
}
