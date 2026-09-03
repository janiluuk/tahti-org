// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useToast } from '@/contexts/toast-context'
import {
  addCollectionItem,
  createCollection,
  fetchMyCollections,
  type MyCollectionSummary,
} from '@/app/dashboard/collection-actions'

export function AddToCollectionPanel({
  soundId,
  trackTitle,
  onClose,
}: {
  soundId: string
  trackTitle: string
  onClose: () => void
}) {
  const pathname = usePathname()
  const { showToast } = useToast()
  const [collections, setCollections] = useState<MyCollectionSummary[] | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addingSlug, setAddingSlug] = useState<string | null>(null)
  const [addedSlugs, setAddedSlugs] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [creatingBusy, setCreatingBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await fetchMyCollections()
      if (cancelled) return
      if (error) {
        if (error === 'Unauthorized') setNeedsAuth(true)
        else setLoadError(error)
        return
      }
      setCollections(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function addTo(slug: string, name: string) {
    setAddingSlug(slug)
    try {
      const { error } = await addCollectionItem(slug, { soundId })
      if (error) {
        showToast(
          error === 'Already in this playlist' ? error : `Couldn't add track — ${error}`,
          'error',
        )
        return
      }
      setAddedSlugs((prev) => new Set(prev).add(slug))
      showToast(`Added to ${name}`, 'success')
    } finally {
      setAddingSlug(null)
    }
  }

  async function createAndAdd() {
    const name = newName.trim()
    if (!name) return
    setCreatingBusy(true)
    try {
      const { error, slug } = await createCollection({ name, style: 'PLAYLIST' })
      if (error || !slug) {
        showToast(error ?? "Couldn't create playlist", 'error')
        return
      }
      const addRes = await addCollectionItem(slug, { soundId })
      if (addRes.error) {
        showToast(addRes.error, 'error')
        return
      }
      setCollections((prev) => [{ slug, name, style: 'PLAYLIST' }, ...(prev ?? [])])
      setAddedSlugs((prev) => new Set(prev).add(slug))
      setNewName('')
      setCreating(false)
      showToast(`Created "${name}" and added the track`, 'success')
    } finally {
      setCreatingBusy(false)
    }
  }

  return (
    <div className="mini-player-add-to" role="region" aria-label="Add to playlist">
      <div className="mini-player-add-to__header">
        <span className="mini-player-add-to__title">Add &ldquo;{trackTitle}&rdquo; to&hellip;</span>
        <button
          type="button"
          className="mini-player-add-to__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {needsAuth ? (
        <p className="mini-player-add-to__empty">
          <Link href={`/login?next=${encodeURIComponent(pathname || '/')}`} onClick={onClose}>
            Sign in
          </Link>{' '}
          to save tracks to a playlist.
        </p>
      ) : loadError ? (
        <p className="mini-player-add-to__empty">{loadError}</p>
      ) : collections === null ? (
        <p className="mini-player-add-to__empty">Loading your playlists&hellip;</p>
      ) : (
        <ul className="mini-player-add-to__list">
          {collections.map((c) => {
            const added = addedSlugs.has(c.slug)
            return (
              <li key={c.slug}>
                <button
                  type="button"
                  className="mini-player-add-to__item"
                  disabled={added || addingSlug === c.slug}
                  onClick={() => void addTo(c.slug, c.name)}
                >
                  <span className="mini-player-add-to__item-name">{c.name}</span>
                  <span className="mini-player-add-to__item-action">
                    {added ? 'Added' : addingSlug === c.slug ? 'Adding…' : 'Add'}
                  </span>
                </button>
              </li>
            )
          })}
          {collections.length === 0 && (
            <li className="mini-player-add-to__empty">You don&rsquo;t have any playlists yet.</li>
          )}
        </ul>
      )}

      {!needsAuth &&
        collections !== null &&
        (creating ? (
          <form
            className="mini-player-add-to__new-form"
            onSubmit={(e) => {
              e.preventDefault()
              void createAndAdd()
            }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Playlist name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mini-player-add-to__new-input"
              maxLength={100}
            />
            <button
              type="submit"
              className="mini-player-add-to__new-submit"
              disabled={creatingBusy || !newName.trim()}
            >
              {creatingBusy ? 'Creating…' : 'Create & add'}
            </button>
            <button
              type="button"
              className="mini-player-add-to__new-cancel"
              onClick={() => {
                setCreating(false)
                setNewName('')
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mini-player-add-to__new-toggle"
            onClick={() => setCreating(true)}
          >
            + New playlist
          </button>
        ))}
    </div>
  )
}
