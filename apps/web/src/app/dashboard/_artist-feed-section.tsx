// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { AvatarTile } from '@tahti/ui'
import { LoveButton } from '@/components/love-button'
import {
  CatalogPlaybackButtons,
  type CatalogPlaybackTrack,
} from '@/components/catalog-playback-buttons'

function formatFeedDate(iso: string): string {
  const age = Date.now() - new Date(iso).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (age < minute) return 'just now'
  if (age < hour) return `${Math.floor(age / minute)}m ago`
  if (age < day) return `${Math.floor(age / hour)}h ago`
  if (age < 7 * day) return `${Math.floor(age / day)}d ago`
  if (age < 30 * day) return `${Math.floor(age / (7 * day))}w ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function feedBadge(item: FeedItem): string {
  if (item.kind === 'post') return 'posted'
  if (item.kind === 'track') return 'shared a track'
  const type = item.releaseType.replace(/_/g, ' ').toLowerCase()
  return `released a ${type}`
}

/** Shared with /feed — moved onto the dashboard main page so artists don't
 * need a separate nav item just to see what artists they follow posted. */
export function ArtistFeedSection({
  items,
  followingCount,
  horizontal = false,
}: {
  items: FeedItem[]
  followingCount: number
  horizontal?: boolean
}) {
  return (
    <section className="feed-page feed-page--embedded">
      {items.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">
            {followingCount === 0 ? "You're not following any artists yet." : 'All quiet here.'}
          </p>
          <p className="public-empty-card__hint">
            {followingCount === 0
              ? 'Discover artists on Tahti, then follow them to fill this feed.'
              : 'New posts, tracks, and releases from artists you follow will show up here.'}
          </p>
          <Link href="/listen" className="public-empty-card__cta">
            Discover artists →
          </Link>
        </div>
      ) : (
        <ul className={`feed-list${horizontal ? ' feed-list--horizontal' : ''}`}>
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className={`feed-item${horizontal ? ' feed-item--card' : ''}`}
            >
              <Link href={`/u/${item.artist.username}`} className="feed-item__avatar">
                <AvatarTile size="sm" name={item.artist.displayName} src={item.artist.avatarUrl} />
              </Link>
              <div className="feed-item__body">
                <div className="feed-item__byline">
                  <Link href={`/u/${item.artist.username}`} className="feed-item__artist">
                    {item.artist.displayName}
                  </Link>
                  <span className="feed-item__badge">{feedBadge(item)}</span>
                  <span className="feed-item__date">{formatFeedDate(item.date)}</span>
                </div>
                {item.kind === 'post' ? (
                  <>
                    <Link href={item.url} className="feed-item__content feed-item__content--visual">
                      {(item.images[0] ?? item.artist.avatarUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.images[0] ?? item.artist.avatarUrl!}
                          alt=""
                          className="feed-item__art feed-item__art--large"
                        />
                      ) : (
                        <span
                          className="feed-item__art feed-item__art--large feed-item__art--ph"
                          aria-hidden
                        />
                      )}
                      <span className="feed-item__overlay">
                        {item.title && <span className="feed-item__title">{item.title}</span>}
                        <span className="feed-item__text">{item.body}</span>
                      </span>
                    </Link>
                    {item.images.length > 1 && (
                      <div className="feed-item__included-images" aria-label="Included images">
                        {item.images.slice(1).map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={src} src={src} alt="" />
                        ))}
                      </div>
                    )}
                  </>
                ) : item.kind === 'track' ? (
                  <div className="feed-item__track">
                    <Link
                      href={item.url}
                      className="feed-item__content feed-item__content--track feed-item__content--visual"
                    >
                      {item.bannerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.bannerUrl}
                          alt=""
                          className="feed-item__art feed-item__art--large"
                        />
                      ) : (
                        <span
                          className="feed-item__art feed-item__art--large feed-item__art--ph"
                          aria-hidden
                        />
                      )}
                      <span className="feed-item__overlay">
                        <span className="feed-item__title">{item.title}</span>
                      </span>
                    </Link>
                    {horizontal && item.audioUrl && (
                      <CatalogPlaybackButtons
                        item={{
                          id: item.id,
                          title: item.title,
                          audioUrl: item.audioUrl,
                          subtitle: item.artist.displayName,
                          artworkUrl: item.bannerUrl,
                          href: item.url,
                        }}
                        queue={items
                          .filter(
                            (candidate): candidate is Extract<FeedItem, { kind: 'track' }> =>
                              candidate.kind === 'track' && Boolean(candidate.audioUrl),
                          )
                          .map((candidate): CatalogPlaybackTrack => ({
                            id: candidate.id,
                            title: candidate.title,
                            audioUrl: candidate.audioUrl!,
                            subtitle: candidate.artist.displayName,
                            artworkUrl: candidate.bannerUrl,
                            href: candidate.url,
                          }))}
                      />
                    )}
                    <LoveButton
                      channelSlug={item.channelSlug}
                      itemId={item.id}
                      initialLiked={item.liked}
                      initialLikeCount={item.likeCount}
                    />
                  </div>
                ) : (
                  <Link
                    href={item.url}
                    className="feed-item__content feed-item__content--track feed-item__content--visual"
                  >
                    {item.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.artworkUrl}
                        alt=""
                        className="feed-item__art feed-item__art--large"
                      />
                    ) : (
                      <span
                        className="feed-item__art feed-item__art--large feed-item__art--ph"
                        aria-hidden
                      />
                    )}
                    <span className="feed-item__overlay">
                      <span className="feed-item__title">{item.title}</span>
                    </span>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
