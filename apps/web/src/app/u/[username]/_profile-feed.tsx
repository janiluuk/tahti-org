// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

interface FeedPost {
  id: string
  title: string | null
  body: string
  images: string[]
  publishAt: string
}

interface FeedRelease {
  id: string
  title: string
  type: string
  releaseDate: string
  artworkUrl: string | null
  smartLinkSlug: string
}

type FeedItem =
  | { kind: 'post'; date: string; post: FeedPost }
  | { kind: 'release'; date: string; release: FeedRelease }

function formatFeedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ProfileFeed({ posts, releases }: { posts: FeedPost[]; releases: FeedRelease[] }) {
  const items: FeedItem[] = [
    ...posts.map((post): FeedItem => ({ kind: 'post', date: post.publishAt, post })),
    ...releases.map(
      (release): FeedItem => ({ kind: 'release', date: release.releaseDate, release }),
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (items.length === 0) {
    return (
      <div className="public-empty-card">
        <p className="public-empty-card__text">No activity yet.</p>
        <p className="public-empty-card__hint">
          Posts and new releases will show up here as they happen.
        </p>
      </div>
    )
  }

  return (
    <ul className="prof-feed-list">
      {items.map((item) =>
        item.kind === 'post' ? (
          <li key={`post-${item.post.id}`} className="prof-feed-item">
            <div className="prof-feed-item__badge prof-feed-item__badge--post">Post</div>
            <div className="prof-feed-item__body">
              {item.post.title && <div className="ch-posts-list__title">{item.post.title}</div>}
              <div className="ch-posts-list__date">{formatFeedDate(item.post.publishAt)}</div>
              <p className="ch-posts-list__body">{item.post.body}</p>
              {item.post.images.length > 0 && (
                <div className="ch-posts-list__images">
                  {item.post.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="ch-posts-list__image" />
                  ))}
                </div>
              )}
            </div>
          </li>
        ) : (
          <li key={`release-${item.release.id}`} className="prof-feed-item">
            <div className="prof-feed-item__badge prof-feed-item__badge--release">New release</div>
            <Link href={`/r/${item.release.smartLinkSlug}`} className="prof-feed-item__body">
              {item.release.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.release.artworkUrl}
                  alt=""
                  className="prof-feed-item__art"
                  width={48}
                  height={48}
                />
              )}
              <div>
                <div className="ch-posts-list__title">{item.release.title}</div>
                <div className="ch-posts-list__date">
                  {formatFeedDate(item.release.releaseDate)}
                </div>
              </div>
            </Link>
          </li>
        ),
      )}
    </ul>
  )
}
