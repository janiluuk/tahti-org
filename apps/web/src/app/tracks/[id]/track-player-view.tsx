// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePlayer } from '@/contexts/player-context'
import { ArchiveWaveform } from '@/components/archive-waveform'

export interface TrackPlayerData {
  id: string
  title: string
  artistName: string
  channelSlug: string
  channel: { username: string; displayName: string; avatarUrl: string | null; bio: string | null }
  durationSec: number | null
  audioUrl: string | null
  bannerUrl: string | null
  peaks: number[] | null
  description: string | null
  commentary: string | null
  genre: string | null
}

export function TrackPlayerView({ track }: { track: TrackPlayerData }) {
  const { track: playerTrack, playing, load, togglePlay, currentTime, duration, seek } = usePlayer()
  const isCurrent = playerTrack?.id === track.id
  const progress = isCurrent && duration > 0 ? currentTime / duration : 0

  async function toggle() {
    if (!track.audioUrl) return
    if (!isCurrent) {
      load(
        {
          id: track.id,
          kind: 'archive',
          url: track.audioUrl,
          title: track.title,
          subtitle: track.artistName,
          artworkUrl: track.bannerUrl,
        },
        { autoplay: true },
      )
      return
    }
    await togglePlay()
  }

  return (
    <main className="track-player-page">
      <Link href={`/c/${track.channelSlug}`} className="track-player-page__back">
        ← {track.channel.displayName}
      </Link>
      <section className="track-player-page__card">
        {track.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.bannerUrl} alt="" className="track-player-page__art" />
        ) : (
          <div className="track-player-page__art track-player-page__art--ph" aria-hidden />
        )}
        <p className="track-player-page__eyebrow">Track player</p>
        <h1 className="track-player-page__title">{track.title}</h1>
        <Link href={`/u/${track.channel.username}`} className="track-player-page__artist">
          {track.artistName}
        </Link>
        {track.peaks && track.peaks.length > 0 && (
          <ArchiveWaveform
            peaks={track.peaks}
            progress={progress}
            onSeek={isCurrent ? seek : undefined}
            size="large"
          />
        )}
        <button
          type="button"
          className="track-player-page__play"
          onClick={() => void toggle()}
          disabled={!track.audioUrl}
          aria-label={isCurrent && playing ? `Pause ${track.title}` : `Play ${track.title}`}
        >
          {isCurrent && playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        {track.genre && <p className="track-player-page__meta">{track.genre}</p>}
        {track.description && <p className="track-player-page__copy">{track.description}</p>}
      </section>
    </main>
  )
}
