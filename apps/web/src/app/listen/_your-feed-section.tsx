// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { FeedPostModal } from './_feed-post-modal'
import { feedCover, feedHeadline, feedTeaser, formatFeedDate } from './_feed-format'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface FeedData {
  items: FeedItem[]
  followingCount: number
}

function itemKey(item: FeedItem): string {
  return `${item.kind}-${item.id}`
}

function FeedBannerCard({ item, onOpen }: { item: FeedItem; onOpen: (item: FeedItem) => void }) {
  const [expanded, setExpanded] = useState(false)
  const cover = feedCover(item)
  const headline = feedHeadline(item)
  const teaser = feedTeaser(item)
  const expandable = item.kind === 'post' && item.body.length > 200

  return (
    <article className="feed-banner">
      <div
        className="feed-banner__cover"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        aria-hidden={!cover}
      />
      <div className="feed-banner__text">
        <button type="button" className="feed-banner__headline" onClick={() => onOpen(item)}>
          {headline}
        </button>
        <p className={`feed-banner__body${expanded ? ' feed-banner__body--expanded' : ''}`}>
          {teaser}
        </p>
        {expandable && (
          <button
            type="button"
            className="feed-banner__toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        <div className="feed-banner__meta">
          <Link href={`/u/${item.artist.username}`} className="feed-banner__artist">
            {item.artist.displayName}
          </Link>
          <span className="feed-banner__date">{formatFeedDate(item.date)}</span>
        </div>
      </div>
    </article>
  )
}

/** Was embedded on the artist dashboard ("so artists don't need a separate
 * nav item just to see what artists they follow posted") — moved here since
 * following/being followed isn't an artist-only concept, and a listener with
 * no channel had no equivalent way to see it at all. */
export function YourFeedSection({ viewerUsername }: { viewerUsername: string | null }) {
  const [data, setData] = useState<FeedData | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState<FeedItem | null>(null)

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
    setOpenItem(null)
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
    setOpenItem(updated)
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
  const bannerItems = items.filter((i) => i.kind === 'post' || i.kind === 'release').slice(0, 3)
  const bannerKeys = new Set(bannerItems.map(itemKey))
  const updateItems = items.filter((i) => !bannerKeys.has(itemKey(i))).slice(0, 10)

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
        <div className="feed-hero">
          <div className="feed-hero__main">
            {bannerItems.map((item) => (
              <FeedBannerCard key={itemKey(item)} item={item} onOpen={setOpenItem} />
            ))}
          </div>
          {updateItems.length > 0 && (
            <div className="feed-hero__aside">
              <h3 className="feed-updates__title">Updates</h3>
              <ul className="feed-updates-list">
                {updateItems.map((item) => (
                  <li key={itemKey(item)}>
                    <button
                      type="button"
                      className="feed-updates-row"
                      onClick={() => setOpenItem(item)}
                    >
                      <span className="feed-updates-row__header">{feedHeadline(item)}</span>
                      <span className="feed-updates-row__teaser">{feedTeaser(item)}</span>
                      <span className="feed-updates-row__date">{formatFeedDate(item.date)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {openItem && (
        <FeedPostModal
          item={openItem}
          viewerUsername={viewerUsername}
          onClose={() => setOpenItem(null)}
          onDeleted={removeItem}
          onUpdated={updateItem}
        />
      )}
    </section>
  )
}
