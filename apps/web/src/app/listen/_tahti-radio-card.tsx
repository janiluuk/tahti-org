// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePlayer } from '@/contexts/player-context'

export function TahtiRadioCard({
  hlsUrl,
  title,
  artistName,
  artworkUrl,
}: {
  hlsUrl: string | null
  title: string
  artistName: string | null
  artworkUrl: string | null
}) {
  const { track, playing, load, togglePlay } = usePlayer()
  const isCurrent = hlsUrl != null && track?.id === hlsUrl

  function handleClick() {
    if (!hlsUrl) return
    if (isCurrent) {
      void togglePlay()
      return
    }
    load(
      {
        id: hlsUrl,
        kind: 'live',
        url: hlsUrl,
        title,
        subtitle: artistName ?? '@tahti-radio',
        href: '/radio',
        artworkUrl,
        isReplay: true,
      },
      { autoplay: true },
    )
  }

  return (
    <button
      type="button"
      className="listen-radio-card"
      onClick={handleClick}
      disabled={!hlsUrl}
      aria-label={hlsUrl ? `Play Tahti Radio — ${title}` : 'Tahti Radio is offline'}
    >
      {artworkUrl && (
        <div
          className="listen-radio-card__backdrop"
          style={{ backgroundImage: `url(${artworkUrl})` }}
          aria-hidden
        />
      )}
      <div className="listen-radio-card__play" aria-hidden>
        {isCurrent && playing ? (
          <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor">
            <rect x="3" y="2" width="4" height="14" rx="1" />
            <rect x="11" y="2" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 18 18" fill="currentColor">
            <path d="M5 3l11 6-11 6V3z" />
          </svg>
        )}
      </div>
      <div className="listen-radio-card__body">
        <span className="listen-radio-card__label">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2 11 Q8 5 14 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M4.5 13 Q8 9 11.5 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="8" cy="7" r="1.5" fill="currentColor" />
          </svg>
          Tahti Radio
        </span>
        {hlsUrl ? (
          <>
            <span className="listen-radio-card__title">{title}</span>
            {artistName && <span className="listen-radio-card__artist">{artistName}</span>}
          </>
        ) : (
          <span className="listen-radio-card__title">Temporarily offline</span>
        )}
      </div>
    </button>
  )
}
