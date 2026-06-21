// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ArchiveItemSource } from '@tahti/shared'
import {
  updateCollection,
  reorderCollectionItems,
  deleteCollection,
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
  } | null
  release: {
    id: string
    title: string
    type: string
    smartLinkSlug: string
    artworkUrl: string | null
  } | null
}

interface CollectionDetail {
  id: string
  slug: string
  name: string
  description: string | null
  type: string
  style: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  isPublic: boolean
  isFeatured: boolean
  items: CollectionItem[]
}

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

export function CollectionEditor({ collection: initial }: { collection: CollectionDetail }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Settings state
  const [name, setName] = useState(initial.name)
  const [style, setStyle] = useState(initial.style)
  const [isPublic, setIsPublic] = useState(initial.isPublic)
  const [isFeatured, setIsFeatured] = useState(initial.isFeatured)
  const [description, setDescription] = useState(initial.description ?? '')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Tracklist state
  const [items, setItems] = useState(initial.items)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [reorderSaving, setReorderSaving] = useState(false)
  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false)
  const [mixcloudModalOpen, setMixcloudModalOpen] = useState(false)

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
  }, [initial.slug, isPublic, isFeatured, description, router])

  const moveItem = useCallback((fromIdx: number, toIdx: number) => {
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved!)
      return next.map((item, i) => ({ ...item, position: i + 1 }))
    })
  }, [])

  const persistItemOrder = useCallback(async () => {
    if (reorderSaving) return
    setReorderSaving(true)
    await reorderCollectionItems(
      initial.slug,
      items.map((i) => i.id),
    )
    setReorderSaving(false)
  }, [initial.slug, items, reorderSaving])

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
            <button
              type="button"
              className="studio-btn-primary"
              onClick={() => void saveSettings()}
              disabled={settingsSaving || isPending}
            >
              {settingsSaving ? 'Saving…' : 'Save settings'}
            </button>
          )}
          {settingsSaved && !settingsDirty && (
            <span className="collection-editor__saved">Saved</span>
          )}

          {/* Danger zone */}
          <div className="collection-editor__danger">
            <h3 className="collection-editor__danger-title">Danger zone</h3>
            {!confirmDelete ? (
              <button
                type="button"
                className="studio-btn-ghost collection-editor__delete-btn"
                onClick={() => setConfirmDelete(true)}
              >
                Delete collection
              </button>
            ) : (
              <div className="collection-editor__confirm-delete">
                <p>Delete &ldquo;{initial.name}&rdquo;? This removes it from all smart links.</p>
                <div className="collection-editor__confirm-btns">
                  <button
                    type="button"
                    className="studio-btn-ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="studio-btn-primary collection-editor__delete-confirm"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
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
              <Link href="/dashboard#archive" className="studio-btn-ghost studio-btn-sm">
                + Tahti library
              </Link>
              <button
                type="button"
                className="studio-btn-ghost studio-btn-sm collection-editor__add-btn--spotify"
                onClick={() => setSpotifyModalOpen(true)}
              >
                + Spotify
              </button>
              <button
                type="button"
                className="studio-btn-ghost studio-btn-sm collection-editor__add-btn--mixcloud"
                onClick={() => setMixcloudModalOpen(true)}
              >
                + Mixcloud
              </button>
            </div>
          </div>

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
                    },
                    release: null,
                  },
                ])
              }}
            />
          ) : null}

          {items.length === 0 ? (
            <div className="studio-empty-card collection-editor__empty">
              <p className="studio-empty-card__text">No items yet</p>
              <p className="studio-empty-card__hint">
                Add archive recordings or releases from your catalog tab.
              </p>
              <Link
                href="/dashboard#archive"
                className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm"
              >
                Open archive →
              </Link>
            </div>
          ) : (
            <ol className="collection-tracklist" onPointerUp={() => void persistItemOrder()}>
              {items.map((item, idx) => {
                const thumb = itemThumb(item)
                const title = itemTitle(item)
                const dur = item.archiveItem?.durationSec
                const source = item.archiveItem?.source
                const badgeLabel = source ? SOURCE_BADGE_LABEL[source] : undefined
                const badgeClass = source ? SOURCE_BADGE_CLASS[source] : undefined
                return (
                  <li
                    key={item.id}
                    className="collection-tracklist__row"
                    draggable
                    onDragStart={() => setDragFrom(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragFrom !== null && dragFrom !== idx) {
                        moveItem(dragFrom, idx)
                        setDragFrom(null)
                      }
                    }}
                  >
                    <span className="collection-tracklist__drag" aria-hidden>
                      ⠿
                    </span>
                    <span className="collection-tracklist__pos">{idx + 1}</span>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="collection-tracklist__thumb" />
                    ) : (
                      <div className="collection-tracklist__thumb collection-tracklist__thumb--ph" />
                    )}
                    <span className="collection-tracklist__title">{title}</span>
                    {badgeLabel ? (
                      <span className={`collection-tracklist__badge ${badgeClass ?? ''}`}>
                        {badgeLabel}
                      </span>
                    ) : null}
                    {dur != null && (
                      <span className="collection-tracklist__dur">{formatDuration(dur)}</span>
                    )}
                    {reorderSaving && (
                      <span className="collection-tracklist__saving" aria-hidden>
                        …
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
