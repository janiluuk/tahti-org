// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type {
  CollectionGalleryMode,
  CollectionTextLayerAlignment,
  CollectionTextLayerMode,
} from '@tahti/shared'
import { Panel } from '@tahti/ui'
import {
  addCollectionItem,
  createCollection,
  deleteCollection,
  reorderCollectionItems,
  updateCollection,
} from './collection-actions'
import { CollectionThemeEditor } from './collection-theme-editor'
import { collectionRssUrl } from '@/lib/rss-feeds'

interface CollectionRow {
  id: string
  slug: string
  name: string
  type: string
  isPublic: boolean
  isFeatured?: boolean
  coverUrl?: string | null
  description?: string | null
  galleryMode?: CollectionGalleryMode
  slideshowImages?: string[]
  videoBackgroundUrl?: string | null
  textLayerMode?: CollectionTextLayerMode
  textLayerText?: string
  textLayerAlign?: CollectionTextLayerAlignment
  _count?: { items: number }
  items?: Array<{
    id: string
    position: number
    archiveItem: { id: string; title: string } | null
    release: { id: string; title: string } | null
  }>
}

export default function CollectionsPanel({
  initial,
  username,
  apiUrl,
  archiveItems,
  publishedReleases,
}: {
  initial: CollectionRow[]
  username: string
  apiUrl: string
  archiveItems: Array<{ id: string; title: string }>
  publishedReleases: Array<{ id: string; title: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [addSlug, setAddSlug] = useState<string | null>(null)
  const [editCoverSlug, setEditCoverSlug] = useState<string | null>(null)
  const [editDescSlug, setEditDescSlug] = useState<string | null>(null)
  const [editThemeSlug, setEditThemeSlug] = useState<string | null>(null)
  const [coverDraft, setCoverDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [pickArchive, setPickArchive] = useState('')
  const [pickRelease, setPickRelease] = useState('')

  function create() {
    setError(null)
    if (!name.trim()) return
    startTransition(async () => {
      const res = await createCollection({ name: name.trim(), type: 'MIX_SERIES' })
      if (res.error) {
        setError(res.error)
        return
      }
      setName('')
      router.refresh()
    })
  }

  function addItem(slug: string) {
    setError(null)
    startTransition(async () => {
      const res = await addCollectionItem(
        slug,
        pickArchive
          ? { archiveItemId: pickArchive }
          : pickRelease
            ? { releaseId: pickRelease }
            : {},
      )
      if (res.error) {
        setError(res.error)
        return
      }
      setAddSlug(null)
      setPickArchive('')
      setPickRelease('')
      router.refresh()
    })
  }

  function applyReorder(collectionSlug: string, itemIds: string[]) {
    startTransition(async () => {
      const res = await reorderCollectionItems(collectionSlug, itemIds)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function moveItem(
    collectionSlug: string,
    items: NonNullable<CollectionRow['items']>,
    index: number,
    dir: -1 | 1,
  ) {
    const next = index + dir
    if (next < 0 || next >= items.length) return
    const ids = [...items].sort((a, b) => a.position - b.position).map((i) => i.id)
    const swapped = [...ids]
    ;[swapped[index], swapped[next]] = [swapped[next], swapped[index]]
    applyReorder(collectionSlug, swapped)
  }

  function reorderByDrag(
    collectionSlug: string,
    items: NonNullable<CollectionRow['items']>,
    fromIndex: number,
    toIndex: number,
  ) {
    if (fromIndex === toIndex) return
    const ids = [...items].sort((a, b) => a.position - b.position).map((i) => i.id)
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, moved)
    applyReorder(collectionSlug, ids)
  }

  function toggleFeatured(slug: string, isFeatured: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await updateCollection(slug, { isFeatured })
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function openCoverEdit(c: CollectionRow) {
    setEditCoverSlug(c.slug)
    setCoverDraft(c.coverUrl ?? '')
    setError(null)
  }

  function saveCover(slug: string) {
    setError(null)
    startTransition(async () => {
      const trimmed = coverDraft.trim()
      const res = await updateCollection(slug, { coverUrl: trimmed || null })
      if (res.error) {
        setError(res.error)
        return
      }
      setEditCoverSlug(null)
      setCoverDraft('')
      router.refresh()
    })
  }

  function openDescEdit(c: CollectionRow) {
    setEditDescSlug(c.slug)
    setDescDraft(c.description ?? '')
    setError(null)
  }

  function saveDescription(slug: string) {
    setError(null)
    startTransition(async () => {
      const trimmed = descDraft.trim()
      const res = await updateCollection(slug, { description: trimmed || null })
      if (res.error) {
        setError(res.error)
        return
      }
      setEditDescSlug(null)
      setDescDraft('')
      router.refresh()
    })
  }

  function remove(slug: string) {
    if (!confirm(`Delete collection "${slug}"?`)) return
    startTransition(async () => {
      await deleteCollection(slug)
      router.refresh()
    })
  }

  return (
    <Panel
      title="Collections"
      headerTight
      description='Group mixes or releases into series (e.g. "Trance sets"). Public collections appear on your profile with RSS feeds.'
      className="import-page__panel"
      flushTop
    >
      <div className="studio-row--between studio-mb-sm">
        <span className="studio-text-muted-sm">
          {initial.length} collection{initial.length === 1 ? '' : 's'}
        </span>
        <a href={`/u/${username}`} className="ui-btn ui-btn--sm ui-btn--ghost">
          Profile ↗
        </a>
      </div>

      {initial.length > 0 && (
        <ul className="studio-list">
          {initial.map((c) => (
            <li key={c.id} className="studio-collection-card">
              <div className="studio-card-row">
                <span className="studio-collection-row-title">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.coverUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="studio-collection-thumb"
                    />
                  ) : (
                    <span className="studio-collection-thumb-ph" aria-hidden />
                  )}
                  <span>
                    <strong>{c.name}</strong> · {c._count?.items ?? c.items?.length ?? 0} item(s) ·{' '}
                    <a href={`/u/${username}/c/${c.slug}`} className="studio-link-cta">
                      /c/{c.slug}
                    </a>
                    {c.isPublic && (
                      <span className="studio-text-muted-sm">
                        {' '}
                        ·{' '}
                        <a
                          href={collectionRssUrl(apiUrl, c.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          RSS
                        </a>
                      </span>
                    )}
                    {c.isFeatured && <span className="studio-badge--success"> · Featured</span>}
                  </span>
                </span>
                <span className="studio-actions">
                  {c.isPublic && (
                    <label className="studio-label-row studio-text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(c.isFeatured)}
                        disabled={isPending}
                        onChange={(e) => toggleFeatured(c.slug, e.target.checked)}
                      />
                      Featured
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => openCoverEdit(c)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => openDescEdit(c)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditThemeSlug(editThemeSlug === c.slug ? null : c.slug)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSlug(c.slug)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.slug)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--danger"
                  >
                    Delete
                  </button>
                </span>
              </div>
              {editCoverSlug === c.slug && (
                <div className="studio-row studio-row--wrap studio-mt-md">
                  <input
                    value={coverDraft}
                    onChange={(e) => setCoverDraft(e.target.value)}
                    placeholder="Cover image URL (HTTPS, square works best)"
                    className="studio-input studio-flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => saveCover(c.slug)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--primary"
                  >
                    Save cover
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCoverSlug(null)
                      setCoverDraft('')
                    }}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {editDescSlug === c.slug && (
                <div className="studio-row studio-row--wrap studio-mt-md">
                  <textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    placeholder="Short description for profile and RSS"
                    className="studio-input studio-flex-1"
                    rows={3}
                    maxLength={1000}
                  />
                  <button
                    type="button"
                    onClick={() => saveDescription(c.slug)}
                    disabled={isPending}
                    className="ui-btn ui-btn--sm ui-btn--primary"
                  >
                    Save description
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditDescSlug(null)
                      setDescDraft('')
                    }}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {editThemeSlug === c.slug && (
                <CollectionThemeEditor
                  slug={c.slug}
                  initial={{
                    galleryMode: c.galleryMode ?? 'NONE',
                    slideshowImages: c.slideshowImages ?? [],
                    videoBackgroundUrl: c.videoBackgroundUrl ?? null,
                    textLayerMode: c.textLayerMode ?? 'NONE',
                    textLayerText: c.textLayerText ?? '',
                    textLayerAlign: c.textLayerAlign ?? 'CENTER',
                  }}
                  onDone={() => {
                    setEditThemeSlug(null)
                    router.refresh()
                  }}
                />
              )}
              {c.items && c.items.length > 0 && (
                <ol className="studio-list studio-mt-sm studio-text-muted-sm">
                  {[...c.items]
                    .sort((a, b) => a.position - b.position)
                    .map((it, idx, sorted) => (
                      <li
                        key={it.id}
                        draggable={!isPending}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const from = Number(e.dataTransfer.getData('text/plain'))
                          if (!Number.isNaN(from)) reorderByDrag(c.slug, sorted, from, idx)
                        }}
                        className={`studio-drag-row${isPending ? ' studio-drag-row--disabled' : ''}`}
                      >
                        <span className="studio-flex-1">
                          {it.archiveItem?.title ?? it.release?.title ?? 'Item'}
                        </span>
                        <button
                          type="button"
                          disabled={isPending || idx === 0}
                          onClick={() => moveItem(c.slug, sorted, idx, -1)}
                          aria-label="Move up"
                          className="ui-btn ui-btn--sm ui-btn--ghost"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={isPending || idx === sorted.length - 1}
                          onClick={() => moveItem(c.slug, sorted, idx, 1)}
                          aria-label="Move down"
                          className="ui-btn ui-btn--sm ui-btn--ghost"
                        >
                          ↓
                        </button>
                      </li>
                    ))}
                </ol>
              )}
              {addSlug === c.slug && (
                <div className="studio-row studio-row--wrap studio-mt-md">
                  <select
                    value={pickArchive}
                    onChange={(e) => {
                      setPickArchive(e.target.value)
                      setPickRelease('')
                    }}
                    className="studio-input studio-select-min"
                  >
                    <option value="">Archive mix…</option>
                    {archiveItems.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={pickRelease}
                    onChange={(e) => {
                      setPickRelease(e.target.value)
                      setPickArchive('')
                    }}
                    className="studio-input studio-select-min"
                  >
                    <option value="">Published release…</option>
                    {publishedReleases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addItem(c.slug)}
                    disabled={isPending || (!pickArchive && !pickRelease)}
                    className="ui-btn ui-btn--sm ui-btn--primary"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSlug(null)}
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="studio-input-row studio-mt-lg">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          className="studio-input studio-flex-1"
        />
        <button
          type="button"
          onClick={create}
          disabled={isPending || !name.trim()}
          className="ui-btn ui-btn--primary"
        >
          Create
        </button>
      </div>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
