// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useId } from 'react'
import Link from 'next/link'
import { LoveButton } from '@/components/love-button'
import { useSwitchProfileTab } from './_profile-tab-context'
import { formatDuration, type TrackTabItem } from './_tracks-tab'

/** Opened by clicking a track in the Music tab — full artwork + info, then a
 * way onward: to the actual Release (when this track belongs to one), to
 * love it, or to the artist's bio (switches ProfileTabs' own tab instead of
 * navigating, since we're already on this artist's page). */
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
    if (switchTab) {
      switchTab('stage')
      onClose()
    }
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

          <div className="prof-track-modal__actions">
            {channelSlug && (
              <div className="prof-track-modal__love">
                <LoveButton channelSlug={channelSlug} itemId={track.id} />
              </div>
            )}
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
