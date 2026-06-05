// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addCollectionItem,
  createCollection,
  deleteCollection,
  reorderCollectionItems,
  updateCollection,
} from './collection-actions'

interface CollectionRow {
  id: string
  slug: string
  name: string
  type: string
  isPublic: boolean
  isFeatured?: boolean
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
  archiveItems,
  publishedReleases,
}: {
  initial: CollectionRow[]
  username: string
  archiveItems: Array<{ id: string; title: string }>
  publishedReleases: Array<{ id: string; title: string }>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [addSlug, setAddSlug] = useState<string | null>(null)
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

  function remove(slug: string) {
    if (!confirm(`Delete collection "${slug}"?`)) return
    startTransition(async () => {
      await deleteCollection(slug)
      router.refresh()
    })
  }

  return (
    <section className="studio-panel-section">
      <div className="studio-row--between">
        <h2 className="studio-section-heading studio-m-0">Collections</h2>
        <a href={`/u/${username}`} className="studio-link-cta">
          Profile ↗
        </a>
      </div>
      <p className="studio-help">
        Group mixes or releases into series (e.g. &quot;Trance sets&quot;). Public collections
        appear on your profile with RSS feeds.
      </p>

      {initial.length > 0 && (
        <ul className="studio-list studio-mt-lg">
          {initial.map((c) => (
            <li key={c.id} className="studio-item-row--list">
              <div className="studio-card-row">
                <span>
                  <strong>{c.name}</strong> · {c._count?.items ?? c.items?.length ?? 0} item(s) ·{' '}
                  <a href={`/u/${username}/c/${c.slug}`} className="studio-link-cta">
                    /c/{c.slug}
                  </a>
                  {c.isPublic && <span className="studio-text-muted-sm"> · RSS</span>}
                  {c.isFeatured && <span className="studio-badge--success"> · Featured</span>}
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
                    onClick={() => setAddSlug(c.slug)}
                    disabled={isPending}
                    className="studio-btn-ghost"
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.slug)}
                    disabled={isPending}
                    className="studio-btn-danger"
                  >
                    Delete
                  </button>
                </span>
              </div>
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
                          className="studio-btn-icon"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={isPending || idx === sorted.length - 1}
                          onClick={() => moveItem(c.slug, sorted, idx, 1)}
                          aria-label="Move down"
                          className="studio-btn-icon"
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
                    className="studio-btn-primary"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddSlug(null)}
                    className="studio-btn-ghost"
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
          className="studio-btn-primary"
        >
          Create
        </button>
      </div>
      {error && <p className="studio-text-error">{error}</p>}
    </section>
  )
}
