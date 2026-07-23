// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import {
  addCollectionItem,
  fetchMyCollections,
  type MyCollectionSummary,
} from './collection-actions'

/** Owner-only: add one of your own tracks to one of your own collections
 * (aka playlists — CollectionStyle.PLAYLIST is the default style, but any
 * collection can hold tracks). Lazily loads the picker list on open. */
export function AddToPlaylistButton({ archiveItemId }: { archiveItemId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collections, setCollections] = useState<MyCollectionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addedTo, setAddedTo] = useState<string | null>(null)

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setError(null)
    setAddedTo(null)
    if (collections !== null) return
    setLoading(true)
    const res = await fetchMyCollections()
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setCollections(res.data ?? [])
  }

  async function add(slug: string) {
    setError(null)
    const res = await addCollectionItem(slug, { archiveItemId })
    if (res.error) {
      setError(res.error)
      return
    }
    setAddedTo(slug)
  }

  return (
    <div className="add-to-playlist">
      <button
        type="button"
        className="ui-btn ui-btn--sm ui-btn--ghost"
        onClick={() => void toggle()}
      >
        Add to playlist
      </button>
      {open && (
        <div className="add-to-playlist__menu">
          {loading ? (
            <p className="studio-text-muted-sm">Loading…</p>
          ) : error ? (
            <p className="studio-notice studio-notice--error">{error}</p>
          ) : collections && collections.length === 0 ? (
            <p className="studio-text-muted-sm">No playlists yet — create one in Collections.</p>
          ) : (
            <ul className="add-to-playlist__list">
              {collections?.map((c) => (
                <li key={c.slug}>
                  <button type="button" onClick={() => void add(c.slug)}>
                    {c.name}
                    {addedTo === c.slug && ' ✓'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
