// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useId } from 'react'
import Link from 'next/link'
import { LoveButton } from '@/components/love-button'
import { ReportButton } from '@/components/report-button'
import { usePlayer } from '@/contexts/player-context'
import { HearthisEmbedRow } from './c/[slug]/_hearthis-embed-row'
import { MixcloudEmbedRow } from './c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from './c/[slug]/_spotify-embed-row'
import { useSwitchProfileTab } from './_profile-tab-context'
import { formatDuration, type TrackTabItem } from './_tracks-tab'

/** *_EMBED-sourced items have no audio file — playUrl is always null for
 * these — so they need the same embed widgets collection pages already use
 * instead of the native play button below. */
function EmbedPlayer({ track }: { track: TrackTabItem }) {
  if (!track.embedUri) return null
  switch (track.embedProvider) {
    case 'HEARTHIS':
      return <HearthisEmbedRow title={track.title} embedUri={track.embedUri} />
    case 'MIXCLOUD':
      return <MixcloudEmbedRow title={track.title} embedUri={track.embedUri} />
    case 'SPOTIFY':
      return <SpotifyEmbedRow title={track.title} embedUri={track.embedUri} />
    default:
      return null
  }
}

/** Opened by clicking a track in the Music tab — full artwork + info, then a
 * way onward: to the actual Release (when this track belongs to one), to
 * love it, or to the artist's bio (switches ProfileTabs' own tab instead of
 * navigating, since we're already on this artist's page). Playback mirrors
 * ArchiveTrackRow (the collection page's track row): the shared mini-player
 * for a real audio file, the matching embed widget for a *_EMBED item. */
export function TrackDetailModal({
  track,
  channelSlug,
  username,
  onClose,
}: {
  track: TrackTabItem
  channelSlug: string | null
  username: string
  onClose: () => void
}) {
  const titleId = useId()
  const switchTab = useSwitchProfileTab()
  const { track: playerTrack, playing, load, togglePlay } = usePlayer()
  const isCurrent = playerTrack?.id === track.id
  const isEmbed = Boolean(track.embedProvider && track.embedUri)

  async function handleTogglePlay() {
    if (!track.playUrl) return
    if (!isCurrent) {
      load(
        {
          id: track.id,
          kind: 'archive',
          url: track.playUrl,
          title: track.title,
          subtitle: track.artistName ?? undefined,
          artworkUrl: track.bannerUrl,
        },
        { autoplay: true },
      )
      return
    }
    await togglePlay()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  function viewArtistBio() {
    // Bio is always visible on the page now (not tab-gated) — just close the
    // modal so it's right there behind it.
    onClose()
  }

  return (
    <div
      className="prof-track-modal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="prof-track-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="prof-track-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        <div className="prof-track-modal__art">
          {track.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.bannerUrl} alt="" />
          ) : (
            <span className="prof-track-modal__art-ph" aria-hidden />
          )}
          {!isEmbed && track.playUrl && (
            <button
              type="button"
              className="prof-track-modal__play"
              onClick={() => void handleTogglePlay()}
              aria-label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
            >
              {isCurrent && playing ? '❚❚' : '▶'}
            </button>
          )}
        </div>

        <div className="prof-track-modal__body">
          <h2 id={titleId} className="prof-track-modal__title">
            {track.title}
          </h2>
          <p className="prof-track-modal__meta">
            {track.artistName ? `${track.artistName}` : null}
            {track.artistName && track.durationSec != null ? ' · ' : null}
            {formatDuration(track.durationSec)}
          </p>

          {isEmbed && <EmbedPlayer track={track} />}

          <div className="prof-track-modal__actions">
            {channelSlug && (
              <div className="prof-track-modal__love">
                <LoveButton channelSlug={channelSlug} itemId={track.id} />
              </div>
            )}
            <ReportButton targetType="ARCHIVE_ITEM" targetId={track.id} variant="icon" />
            {track.releaseSlug ? (
              <Link href={`/r/${track.releaseSlug}`} className="prof-track-modal__primary">
                View release
              </Link>
            ) : (
              track.channelItemUrl && (
                <Link href={track.channelItemUrl} className="prof-track-modal__primary">
                  View on channel
                </Link>
              )
            )}
            {switchTab ? (
              <button type="button" className="prof-track-modal__secondary" onClick={viewArtistBio}>
                Artist bio
              </button>
            ) : (
              <Link href={`/u/${username}`} className="prof-track-modal__secondary">
                Artist bio
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
