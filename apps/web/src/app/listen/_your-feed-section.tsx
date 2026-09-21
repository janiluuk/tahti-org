'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { resolveClientApiUrl } from '@/lib/api-url'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { FeedCard } from './_feed-card'
import { FeedPostEditModal } from './_feed-post-edit-modal'

const API_BASE = resolveClientApiUrl()
interface FeedData {
  items: FeedItem[]
  followingCount: number
}

function itemKey(item: FeedItem): string {
  return `${item.kind}-${item.id}`
}

/** Was embedded on the artist dashboard ("so artists don't need a separate
 * nav item just to see what artists they follow posted") — moved here since
 * following/being followed isn't an artist-only concept, and a listener with
 * no channel had no equivalent way to see it at all. */
export function YourFeedSection({ viewerUsername }: { viewerUsername: string | null }) {
  const [data, setData] = useState<FeedData | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<Extract<FeedItem, { kind: 'post' }> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me/feed`, { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401) {
          setSignedIn(false)
        } else if (res.ok) {
          setData((await res.json()) as FeedData)
        }
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function removeItem(id: string) {
    setData((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev))
    setEditingItem(null)
  }

  function updateItem(updated: FeedItem) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.kind === updated.kind && i.id === updated.id ? updated : i,
            ),
          }
        : prev,
    )
  }

  if (loading) {
    return (
      <section className="listen-your-feed" aria-busy="true">
        <div className="listen-your-feed__header">
          <h2 className="listen-your-feed__title">Your feed</h2>
        </div>
        <p className="listen-your-feed__hint">Loading…</p>
      </section>
    )
  }

  if (!signedIn) {
    return (
      <section className="listen-your-feed">
        <div className="listen-your-feed__header">
          <h2 className="listen-your-feed__title">Your feed</h2>
        </div>
        <p className="listen-your-feed__hint">
          <Link href="/login?next=/listen">Sign in</Link> to see posts, tracks, and releases from
          artists you follow.
        </p>
      </section>
    )
  }

  const items = data?.items ?? []

  return (
    <section className="listen-your-feed">
      <div className="listen-your-feed__header">
        <h2 className="listen-your-feed__title">Your feed</h2>
      </div>

      {items.length === 0 ? (
        <p className="listen-your-feed__hint">
          {(data?.followingCount ?? 0) === 0 ? (
            <>Follow some artists to fill this feed.</>
          ) : (
            <>All quiet here — new posts, tracks, and releases will show up as they happen.</>
          )}
        </p>
      ) : (
        <div className="feed-grid">
          {items.slice(0, 12).map((item) => (
            <FeedCard
              key={itemKey(item)}
              item={item}
              isOwnerPost={item.kind === 'post' && viewerUsername === item.artist.username}
              onEdit={(post) => setEditingItem(post as Extract<FeedItem, { kind: 'post' }>)}
            />
          ))}
        </div>
      )}

      {editingItem && (
        <FeedPostEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onDeleted={removeItem}
          onUpdated={updateItem}
        />
      )}
    </section>
  )
}
