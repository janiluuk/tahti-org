// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ButtonIcon, Button, SortableList } from '@tahti/ui'
import type { ArchiveItemSource, ArchiveQualityBadge } from '@tahti/shared'
import { QUALITY_BADGE_LABEL } from '@tahti/shared'
import { CoverImageUpload } from '@/components/cover-image-upload'
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
import { SpotifyImportModal, spotifyCoverProxySrc } from './_spotify-import-modal'
import { MixcloudImportModal, mixcloudCoverProxySrc } from './_mixcloud-import-modal'

const SOURCE_BADGE_LABEL: Partial<Record<ArchiveItemSource, string>> = {
  SPOTIFY_EMBED: 'SPOTIFY EMBED',
  MIXCLOUD_EMBED: 'MIXCLOUD EMBED',
  URL_EMBED: 'EMBED',
}

const SOURCE_BADGE_CLASS: Partial<Record<ArchiveItemSource, string>> = {
  SPOTIFY_EMBED: 'collection-tracklist__badge--spotify',
  MIXCLOUD_EMBED: 'collection-tracklist__badge--mixcloud',
  URL_EMBED: 'collection-tracklist__badge--embed',
}

const QUALITY_BADGE_CLASS: Record<ArchiveQualityBadge, string> = {
  LOSSLESS: '',
  TRANSCODED: 'collection-tracklist__badge--transcoded',
  EMBED_ONLY: 'collection-tracklist__badge--embed',
}

interface CollectionItem {
  id: string
  position: number
  archiveItem: {
    id: string
    title: string
    durationSec: number | null
    bannerUrl: string | null
    createdAt: string
    source: ArchiveItemSource
    qualityBadge: ArchiveQualityBadge
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
  items: CollectionItem[]
}

const SORT_MODE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual (drag to reorder)' },
  { value: 'TIME', label: 'By time added' },
  { value: 'NAME', label: 'By name' },
]

const STYLE_OPTIONS = [
  'PLAYLIST',
  'ALBUM',
  'EP',
  'SINGLE',
  'DJ_SET_SERIES',
  'LIVE_ARCHIVE',
  'COMPILATION',
  'MIX_SERIES',
]

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function itemTitle(item: CollectionItem): string {
  return item.archiveItem?.title ?? item.release?.title ?? '—'
}

function itemThumb(item: CollectionItem): string | null {
  const bannerUrl = item.archiveItem?.bannerUrl ?? null
  if (bannerUrl && item.archiveItem?.source === 'SPOTIFY_EMBED') {
    return spotifyCoverProxySrc(bannerUrl)
  }
  if (bannerUrl && item.archiveItem?.source === 'MIXCLOUD_EMBED') {
    return mixcloudCoverProxySrc(bannerUrl)
  }
  return bannerUrl ?? item.release?.artworkUrl ?? null
}

export function CollectionEditor({
  collection: initial,
  myArchiveItems = [],
  myReleases = [],
}: {
  collection: CollectionDetail
  myArchiveItems?: Array<{ id: string; title: string; status: string }>
  myReleases?: Array<{ id: string; title: string; state: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Settings state
  const [name, setName] = useState(initial.name)
  const [style, setStyle] = useState(initial.style)
  const [trackSortMode, setTrackSortMode] = useState(initial.trackSortMode)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured)
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
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [libraryPick, setLibraryPick] = useState('')
  const [libraryAdding, setLibraryAdding] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
  }, [initial.slug, isPublic, isFeatured, style, trackSortMode, description, router])

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
  // dragging would silently do nothing (see docs/worklogs UX sweep, 2026-07-22).
  const canManualReorder = initial.trackSortMode === 'MANUAL'
  const displayItems = useMemo(() => {
    if (canManualReorder) return items
    if (initial.trackSortMode === 'NAME') {
      return [...items].sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)))
    }
    if (initial.trackSortMode === 'TIME') {
      return [...items].sort((a, b) => {
        const at = a.archiveItem?.createdAt ?? a.release?.releaseDate ?? ''
        const bt = b.archiveItem?.createdAt ?? b.release?.releaseDate ?? ''
        return at.localeCompare(bt)
      })
    }
    return items
  }, [items, canManualReorder, initial.trackSortMode])

  const addFromLibrary = useCallback(async () => {
    if (!libraryPick) return
    setLibraryAdding(true)
    setLibraryError(null)
    const [kind, id] = libraryPick.split(':')
    const { error } = await addCollectionItem(
      initial.slug,
      kind === 'archive' ? { archiveItemId: id } : { releaseId: id },
    )
    setLibraryAdding(false)
    if (error) {
      setLibraryError(error)
      return
    }
    setLibraryPick('')
    setLibraryPickerOpen(false)
    startTransition(() => router.refresh())
  }, [initial.slug, libraryPick, router])

  const usedArchiveIds = new Set(items.map((i) => i.archiveItem?.id).filter(Boolean))
  const usedReleaseIds = new Set(items.map((i) => i.release?.id).filter(Boolean))
  const availableArchiveItems = myArchiveItems.filter(
    (a) => a.status === 'READY' && !usedArchiveIds.has(a.id),
  )
  const availableReleases = myReleases.filter((r) => !usedReleaseIds.has(r.id))

  const renderTrackRowBody = useCallback(
    (item: CollectionItem, idx: number) => {
      const thumb = itemThumb(item)
      const title = itemTitle(item)
      const dur = item.archiveItem?.durationSec
      const source = item.archiveItem?.source
      const quality = item.archiveItem?.qualityBadge
      const badgeLabel =
        (source ? SOURCE_BADGE_LABEL[source] : undefined) ??
        (quality ? QUALITY_BADGE_LABEL[quality] : undefined)
      const badgeClass =
        (source ? SOURCE_BADGE_CLASS[source] : undefined) ??
        (quality ? QUALITY_BADGE_CLASS[quality] : undefined)
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
          {badgeLabel ? (
            <span className={`collection-tracklist__badge ${badgeClass ?? ''}`}>{badgeLabel}</span>
          ) : null}
          {dur != null && <span className="collection-tracklist__dur">{formatDuration(dur)}</span>}
          {reorderSaving && (
            <span className="collection-tracklist__saving" aria-hidden>
              …
            </span>
          )}
        </>
      )
    },
    [reorderSaving],
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
      </div>

      <div className="collection-editor__body">
        {/* ── Left: settings ── */}
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

        {/* ── Right: tracklist ── */}
        <section className="collection-editor__tracklist">
          <div className="collection-editor__tracklist-header">
            <h2 className="collection-editor__section-title">
              Tracks &amp; releases
              <span className="collection-editor__count">{items.length}</span>
            </h2>
            <div className="collection-editor__add-buttons">
              <Button onClick={() => setLibraryPickerOpen((v) => !v)} variant="ghost" size="sm">
                + Tahti library
              </Button>
              <Button
                onClick={() => setSpotifyModalOpen(true)}
                variant="ghost"
                size="sm"
                className="collection-editor__add-btn--spotify"
              >
                + Spotify
              </Button>
              <Button
                onClick={() => setMixcloudModalOpen(true)}
                variant="ghost"
                size="sm"
                className="collection-editor__add-btn--mixcloud"
              >
                + Mixcloud
              </Button>
            </div>
          </div>

          {libraryPickerOpen ? (
            <div className="collection-editor__library-picker studio-row studio-row--wrap studio-gap-xs studio-mt-sm">
              <select
                className="studio-input studio-flex-1"
                value={libraryPick}
                onChange={(e) => setLibraryPick(e.target.value)}
              >
                <option value="">Choose an archive item or release…</option>
                {availableArchiveItems.length > 0 && (
                  <optgroup label="Archive items">
                    {availableArchiveItems.map((a) => (
                      <option key={a.id} value={`archive:${a.id}`}>
                        {a.title}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableReleases.length > 0 && (
                  <optgroup label="Releases">
                    {availableReleases.map((r) => (
                      <option key={r.id} value={`release:${r.id}`}>
                        {r.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <Button
                onClick={() => void addFromLibrary()}
                disabled={!libraryPick || libraryAdding}
                variant="primary"
                size="sm"
              >
                <ButtonIcon name="plus" />
                {libraryAdding ? 'Adding…' : 'Add'}
              </Button>
              {libraryError && <p className="studio-text-error studio-text-sm">{libraryError}</p>}
            </div>
          ) : null}

          {spotifyModalOpen ? (
            <SpotifyImportModal
              collectionId={initial.id}
              collectionTitle={name || initial.name}
              onClose={() => setSpotifyModalOpen(false)}
              onAdded={({ archiveItemId, collectionItemId, track }) => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: collectionItemId,
                    position: prev.length + 1,
                    archiveItem: {
                      id: archiveItemId,
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
              onAdded={({ archiveItemId, collectionItemId, track }) => {
                setItems((prev) => [
                  ...prev,
                  {
                    id: collectionItemId,
                    position: prev.length + 1,
                    archiveItem: {
                      id: archiveItemId,
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
                href="/dashboard/archive"
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
