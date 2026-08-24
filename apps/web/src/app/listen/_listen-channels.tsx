// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import type { ChannelCard } from '@tahti/shared'
import { WatcherCount } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { usePlayer } from '@/contexts/player-context'

/** The artwork a card shows: fresh now-playing art first (what's actually on
 * right now), falling back to the artist's avatar, then an initial letter —
 * so a channel with no now-playing metadata doesn't just render black. */
function cardArtworkUrl(channel: ChannelCard): string | null {
  return channel.nowPlaying?.artworkUrl ?? channel.user.avatarUrl ?? null
}

/** Plays a LIVE channel straight from its Discover card — the 24/7 fallback
 * "replay" rotation isn't wired here since it plays back through a different
 * mechanism than the live encoder mount (the full channel page still handles
 * that correctly when a Replay card is clicked through instead). */
function usePlayChannelCard(channel: ChannelCard) {
  const { track, playing, load, togglePlay } = usePlayer()
  const isCurrent = channel.hlsUrl != null && track?.id === channel.hlsUrl
  const canPlayInline = channel.state === 'LIVE' && channel.hlsUrl != null

  async function handlePlayClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canPlayInline) return
    if (isCurrent) {
      await togglePlay()
      return
    }
    load(
      {
        id: channel.hlsUrl!,
        kind: 'live',
        url: channel.hlsUrl!,
        title: channel.nowPlaying?.title ?? channel.user.displayName,
        subtitle: channel.nowPlaying?.artistName ?? `@${channel.user.username}`,
        href: resolveChannelUrl(channel.slug),
        artworkUrl: cardArtworkUrl(channel),
      },
      { autoplay: true },
    )
  }

  return { canPlayInline, isCurrent: isCurrent && playing, handlePlayClick }
}

function LiveCard({ channel, listenerCount }: { channel: ChannelCard; listenerCount?: number }) {
  const { canPlayInline, isCurrent, handlePlayClick } = usePlayChannelCard(channel)
  return (
    <Link href={resolveChannelUrl(channel.slug)} className="listen-live-card">
      <div className="listen-live-card__avatar">
        {cardArtworkUrl(channel) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardArtworkUrl(channel)!} alt={channel.user.displayName} loading="lazy" />
        ) : (
          <span className="listen-live-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="listen-live-card__pulse" aria-hidden />
        {canPlayInline && (
          <button
            type="button"
            className="listen-card__play-btn"
            onClick={(e) => void handlePlayClick(e)}
            aria-label={
              isCurrent ? `Pause ${channel.user.displayName}` : `Play ${channel.user.displayName}`
            }
          >
            {isCurrent ? '❚❚' : '▶'}
          </button>
        )}
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

function cardBgStyle(artworkUrl: string | null | undefined): CSSProperties | undefined {
  return artworkUrl ? ({ '--card-bg-image': `url(${artworkUrl})` } as CSSProperties) : undefined
}

/** Not live, but airing its 24/7 archive rotation right now — same REPLAY
 * convention as Tahti Radio's own badge (see _tahti-radio-card.tsx /
 * mini-player.tsx), just applied to any channel with fallbackEnabled. Not
 * inline-playable from the card (see usePlayChannelCard) — clicking through
 * to the full channel page plays the rotation correctly. */
function ReplayCard({ channel }: { channel: ChannelCard }) {
  const artworkUrl = cardArtworkUrl(channel)
  return (
    <Link
      href={resolveChannelUrl(channel.slug)}
      className="listen-card"
      style={cardBgStyle(artworkUrl)}
    >
      <div className="listen-card__avatar">
        {artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artworkUrl} alt={channel.user.displayName} loading="lazy" />
        ) : (
          <span className="listen-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="listen-card__body">
        <div className="listen-card__name">{channel.user.displayName}</div>
        <div className="listen-card__handle">@{channel.user.username}</div>
        <div className="listen-card__status listen-card__status--replay">REPLAY</div>
      </div>
    </Link>
  )
}

export function ListenChannels({
  live,
  replaying,
  listenerCounts,
}: {
  live: ChannelCard[]
  replaying: ChannelCard[]
  listenerCounts?: Record<string, number>
}) {
  const [genre, setGenre] = useState<string | null>(null)

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const ch of [...live, ...replaying]) {
      for (const g of ch.genres) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [live, replaying])

  const filteredLive = genre ? live.filter((ch) => ch.genres.includes(genre)) : live
  const filteredReplaying = genre ? replaying.filter((ch) => ch.genres.includes(genre)) : replaying
  const empty = filteredLive.length === 0 && filteredReplaying.length === 0

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

          {filteredReplaying.length > 0 && (
            <section className="listen-section">
              <div className="listen-section__label listen-section__label--replay">Replay</div>
              <div className="listen-grid">
                {filteredReplaying.map((ch) => (
                  <ReplayCard key={ch.slug} channel={ch} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
