// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { STYLE_LABEL, STYLE_COLOR } from './collection-labels'

interface CollectionSummary {
  slug: string
  name: string
  style: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  publicProfileOrder: number
  itemCount: number
  itemCovers: string[]
}

// Deterministic palette gradient from collection slug
function slugGradient(slug: string, idx: number): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0
  const hues = [((hash >> 0) & 0xff) % 360, ((hash >> 8) & 0xff) % 360]
  return `linear-gradient(135deg, hsl(${hues[idx % 2]},55%,22%), hsl(${hues[(idx + 1) % 2]},45%,32%))`
}

function CollectionCoverAuto({ slug, covers }: { slug: string; covers: string[] }) {
  const cells = [0, 1, 2, 3]
  return (
    <div className="collections-card__cover-auto">
      {cells.map((i) => {
        const url = covers[i]
        return url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="collections-card__cover-cell" />
        ) : (
          <div
            key={i}
            className="collections-card__cover-cell collections-card__cover-cell--ph"
            style={{ background: slugGradient(slug, i) }}
          />
        )
      })}
    </div>
  )
}

export function CollectionsGrid({ collections }: { collections: CollectionSummary[] }) {
  const [items, setItems] = useState(collections)
  const [saving, setSaving] = useState(false)

  const moveCard = useCallback((fromIdx: number, toIdx: number) => {
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved!)
      return next.map((c, i) => ({ ...c, publicProfileOrder: i }))
    })
  }, [])

  // Persist reorder
  const persistOrder = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/me/collections/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slugs: items.map((c) => c.slug) }),
      })
    } finally {
      setSaving(false)
    }
  }, [items, saving])

  return (
    <div className="collections-grid" onPointerUp={() => void persistOrder()}>
      {items.map((c, idx) => (
        <CollectionCard key={c.slug} collection={c} index={idx} onMove={moveCard} />
      ))}
      {/* New collection tile */}
      <Link href="/dashboard/collections/new" className="collections-card collections-card--new">
        <span className="collections-card__new-icon">+</span>
        <span className="collections-card__new-label">New collection</span>
      </Link>
    </div>
  )
}

function CollectionCard({
  collection: c,
  index,
  onMove,
}: {
  collection: CollectionSummary
  index: number
  onMove: (from: number, to: number) => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const isDraft = c.visibility === 'DRAFT'
  const isUnlisted = c.visibility === 'UNLISTED'

  return (
    <Link
      href={`/dashboard/collections/${c.slug}`}
      className={`collections-card${isDraft || isUnlisted ? ' collections-card--dim' : ''}`}
      draggable
      onDragStart={() => setDragIdx(index)}
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        if (dragIdx !== null && dragIdx !== index) {
          onMove(dragIdx, index)
          setDragIdx(null)
        }
      }}
    >
      {/* Cover */}
      {c.coverMode === 'CUSTOM' && c.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl} alt="" className="collections-card__cover-single" />
      ) : (
        <CollectionCoverAuto slug={c.slug} covers={c.itemCovers} />
      )}

      {/* Info */}
      <div className="collections-card__info">
        <span className="collections-card__name">{c.name}</span>
        <div className="collections-card__meta">
          <span
            className={`collections-pill ${STYLE_COLOR[c.style] ?? 'collections-pill--neutral'}`}
          >
            {STYLE_LABEL[c.style] ?? c.style}
          </span>
          <span className="collections-card__count">
            {c.itemCount} item{c.itemCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="collections-card__status">
          {isDraft ? (
            <span className="collections-status collections-status--draft">○ draft</span>
          ) : isUnlisted ? (
            <span className="collections-status collections-status--unlisted">◐ unlisted</span>
          ) : (
            <span className="collections-status collections-status--public">● public</span>
          )}
        </div>
      </div>
    </Link>
  )
}
