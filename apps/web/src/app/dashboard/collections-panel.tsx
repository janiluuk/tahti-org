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
    <section
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Collections</h2>
        <a href={`/u/${username}`} style={{ fontSize: '0.85rem', color: '#2563eb' }}>
          Profile ↗
        </a>
      </div>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Group mixes or releases into series (e.g. &quot;Trance sets&quot;). Public collections
        appear on your profile with RSS feeds.
      </p>

      {initial.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {initial.map((c) => (
            <li key={c.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span>
                  <strong>{c.name}</strong> · {c._count?.items ?? c.items?.length ?? 0} item(s) ·{' '}
                  <a href={`/u/${username}/c/${c.slug}`} style={{ color: '#2563eb' }}>
                    /c/{c.slug}
                  </a>
                  {c.isPublic && <span style={{ color: '#888', fontSize: '0.8rem' }}> · RSS</span>}
                  {c.isFeatured && (
                    <span style={{ color: '#16a34a', fontSize: '0.8rem' }}> · Featured</span>
                  )}
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {c.isPublic && (
                    <label style={{ fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}>
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
                    style={{ border: '1px solid #ccc', borderRadius: 4, padding: '0.2rem 0.5rem' }}
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.slug)}
                    disabled={isPending}
                    style={{ border: '1px solid #fcc', borderRadius: 4, padding: '0.2rem 0.5rem' }}
                  >
                    Delete
                  </button>
                </span>
              </div>
              {c.items && c.items.length > 0 && (
                <ol
                  style={{ margin: '0.5rem 0 0', paddingLeft: 0, listStyle: 'none', color: '#555' }}
                >
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
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginBottom: 4,
                          cursor: isPending ? 'default' : 'grab',
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          {it.archiveItem?.title ?? it.release?.title ?? 'Item'}
                        </span>
                        <button
                          type="button"
                          disabled={isPending || idx === 0}
                          onClick={() => moveItem(c.slug, sorted, idx, -1)}
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={isPending || idx === sorted.length - 1}
                          onClick={() => moveItem(c.slug, sorted, idx, 1)}
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </li>
                    ))}
                </ol>
              )}
              {addSlug === c.slug && (
                <div
                  style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}
                >
                  <select
                    value={pickArchive}
                    onChange={(e) => {
                      setPickArchive(e.target.value)
                      setPickRelease('')
                    }}
                    style={{ minWidth: 180 }}
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
                    style={{ minWidth: 180 }}
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
                  >
                    Add
                  </button>
                  <button type="button" onClick={() => setAddSlug(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="button" onClick={create} disabled={isPending || !name.trim()}>
          Create
        </button>
      </div>
      {error && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>}
    </section>
  )
}
