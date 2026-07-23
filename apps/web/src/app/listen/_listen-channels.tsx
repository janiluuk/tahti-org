// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ChannelCard } from '@tahti/shared'
import { WatcherCount } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'

function LiveCard({ channel, listenerCount }: { channel: ChannelCard; listenerCount?: number }) {
  return (
    <Link href={resolveChannelUrl(channel.slug)} className="listen-live-card">
      <div className="listen-live-card__avatar">
        {channel.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.user.avatarUrl} alt={channel.user.displayName} />
        ) : (
          <span className="listen-live-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="listen-live-card__pulse" aria-hidden />
      </div>
      <div className="listen-live-card__body">
        <div className="listen-live-card__top-row">
          <div className="listen-live-card__live-badge">
            <span className="listen-live-dot" />
            Live now
          </div>
          {!!listenerCount && (
            <WatcherCount count={listenerCount} className="listen-live-card__watchers" />
          )}
        </div>
        <div className="listen-live-card__name">{channel.user.displayName}</div>
        <div className="listen-live-card__handle">@{channel.user.username}</div>
      </div>
      <div className="listen-live-card__cta">Listen →</div>
    </Link>
  )
}

function ChannelCardItem({ channel }: { channel: ChannelCard }) {
  const isLive = channel.state === 'LIVE'

  return (
    <Link href={resolveChannelUrl(channel.slug)} className="listen-card">
      <div className="listen-card__avatar">
        {channel.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.user.avatarUrl} alt={channel.user.displayName} />
        ) : (
          <span className="listen-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        {isLive && <span className="listen-card__live-dot" aria-label="Live now" />}
      </div>

      <div className="listen-card__body">
        <div className="listen-card__name">{channel.user.displayName}</div>
        <div className="listen-card__handle">@{channel.user.username}</div>
        {isLive ? (
          <div className="listen-card__status listen-card__status--live">● Live now</div>
        ) : channel.nextBroadcastNote ? (
          <div className="listen-card__status">{channel.nextBroadcastNote}</div>
        ) : channel.goneLiveAt ? (
          <div className="listen-card__status listen-card__status--muted">
            Last live{' '}
            {new Date(channel.goneLiveAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

export function ListenChannels({
  live,
  recent,
  listenerCounts,
}: {
  live: ChannelCard[]
  recent: ChannelCard[]
  listenerCounts?: Record<string, number>
}) {
  const [genre, setGenre] = useState<string | null>(null)

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const ch of [...live, ...recent]) {
      for (const g of ch.genres) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [live, recent])

  const filteredLive = genre ? live.filter((ch) => ch.genres.includes(genre)) : live
  const filteredRecent = genre ? recent.filter((ch) => ch.genres.includes(genre)) : recent
  const empty = filteredLive.length === 0 && filteredRecent.length === 0

  return (
    <>
      {genres.length > 0 && (
        <div className="listen-genre-filter" role="group" aria-label="Filter by genre">
          <button
            type="button"
            className={`listen-genre-filter__chip${genre === null ? ' listen-genre-filter__chip--active' : ''}`}
            onClick={() => setGenre(null)}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              className={`listen-genre-filter__chip${genre === g ? ' listen-genre-filter__chip--active' : ''}`}
              onClick={() => setGenre(genre === g ? null : g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {empty ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No channels match this genre right now.</p>
          <p className="public-empty-card__hint">
            <button type="button" className="studio-link" onClick={() => setGenre(null)}>
              Clear filter
            </button>{' '}
            or check back later.
          </p>
        </div>
      ) : (
        <>
          {filteredLive.length > 0 && (
            <section className="listen-section">
              <div className="listen-section__label listen-section__label--live">
                <span className="listen-live-dot" />
                Live now
              </div>
              <div className="listen-live-grid">
                {filteredLive.map((ch) => (
                  <LiveCard key={ch.slug} channel={ch} listenerCount={listenerCounts?.[ch.slug]} />
                ))}
              </div>
            </section>
          )}

          {filteredRecent.length > 0 && (
            <section className="listen-section">
              <div className="listen-section__label">Recently active</div>
              <div className="listen-grid">
                {filteredRecent.map((ch) => (
                  <ChannelCardItem key={ch.slug} channel={ch} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
