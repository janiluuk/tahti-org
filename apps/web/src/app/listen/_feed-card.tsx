'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { Reveal } from '@tahti/ui'
import { feedCover, feedHeadline, feedTeaser, formatFeedDate } from './_feed-format'

const TRUNCATE_AT = 200

function ctaLabel(item: FeedItem): string {
  switch (item.kind) {
    case 'release':
      return 'View release →'
    case 'track':
      return 'Listen →'
    case 'like':
      return 'Listen →'
    case 'post':
      return ''
  }
}

/** One card shape for every feed item kind (post/release/track/like) —
 * previously a "banner" card (posts/releases) and a plain text row
 * (everything else) with unrelated layouts for what's conceptually the
 * same thing. Long post bodies + any extra images beyond the first go
 * behind a Reveal instead of a separate "read more" modal; other kinds
 * have nothing further to reveal, just their destination link. */
export function FeedCard({
  item,
  isOwnerPost,
  onEdit,
}: {
  item: FeedItem
  isOwnerPost: boolean
  onEdit: (item: Extract<FeedItem, { kind: 'post' }>) => void
}) {
  const cover = feedCover(item)
  const headline = feedHeadline(item)
  const teaser = feedTeaser(item)
  const isPost = item.kind === 'post'
  const overflowsTeaser = isPost && item.body.length > TRUNCATE_AT
  const visibleTeaser = overflowsTeaser ? `${item.body.slice(0, TRUNCATE_AT).trimEnd()}…` : teaser
  const extraImages = isPost ? item.images.slice(1) : []

  return (
    <article className="feed-card">
      <div className="feed-card__cover">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="feed-card__cover-img" />
        ) : (
          <div className="feed-card__cover-placeholder" aria-hidden />
        )}
      </div>

      <div className="feed-card__body">
        {isPost ? (
          <p className="feed-card__headline">{headline}</p>
        ) : (
          <Link href={item.url} className="feed-card__headline feed-card__headline--link">
            {headline}
          </Link>
        )}

        <p className="feed-card__teaser">{visibleTeaser}</p>

        {!isPost && (
          <Link href={item.url} className="feed-card__cta">
            {ctaLabel(item)}
          </Link>
        )}

        {item.kind === 'post' && (overflowsTeaser || extraImages.length > 0 || isOwnerPost) && (
          <Reveal>
            {overflowsTeaser && <p className="feed-card__full-body">{item.body}</p>}
            {item.linkUrl && (
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="feed-card__cta"
              >
                {item.linkLabel || item.linkUrl}
              </a>
            )}
            {extraImages.length > 0 && (
              <div className="feed-card__extra-images">
                {extraImages.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="feed-card__extra-image" />
                ))}
              </div>
            )}
            {isOwnerPost && (
              <button
                type="button"
                className="feed-card__edit-trigger"
                onClick={() => onEdit(item)}
              >
                Edit post
              </button>
            )}
          </Reveal>
        )}

        <div className="feed-card__meta">
          <Link href={`/u/${item.artist.username}`} className="feed-card__artist">
            {item.artist.displayName}
          </Link>
          <span className="feed-card__date">{formatFeedDate(item.date)}</span>
        </div>
      </div>
    </article>
  )
}
