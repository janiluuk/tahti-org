// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Link, Text } from '@tahti/ui'

interface Track {
  id: string
  position: number
  title: string
  durationSec: number | null
  hasStream: boolean
}

interface ReleaseEmbed {
  id: string
  title: string
  artworkUrl: string | null
  artist: { username: string; displayName: string }
  profileUrl: string
  tracks: Track[]
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3001'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function ReleaseEmbedPlayer({ release }: { release: ReleaseEmbed }) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function playTrack(track: Track) {
    if (!track.hasStream) {
      setError('This track is not ready to play yet')
      return
    }
    setError(null)
    setLoadingId(track.id)
    try {
      const res = await fetch(`${apiUrl}/api/v1/embed/r/${release.id}/tracks/${track.id}/play`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not load track')
        return
      }
      setPlayingId(track.id)
      setAudioUrl(data.url ?? null)
    } catch {
      setError('Could not load track')
    } finally {
      setLoadingId(null)
    }
  }

  const playable = release.tracks.filter((t) => t.hasStream)

  return (
    <div>
      <div className="embed-header">
        {release.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={release.artworkUrl} alt="" className="embed-artwork" width={56} height={56} />
        )}
        <div className="embed-header__meta">
          <p className="embed-header__title">{release.title}</p>
          <Link
            href={release.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-header__link"
          >
            {release.artist.displayName} on Tahti
          </Link>
        </div>
      </div>

      {playable.length === 0 ? (
        <Text as="p" className="embed-empty">
          No playable tracks yet.
        </Text>
      ) : (
        <ul className="embed-track-list">
          {playable.map((t) => (
            <li key={t.id} className="embed-track-item">
              <button
                type="button"
                onClick={() => playTrack(t)}
                disabled={loadingId === t.id}
                aria-label={`Play ${t.title}`}
                className={`embed-track-play${playingId === t.id ? ' embed-track-play--active' : ''}`}
              >
                {loadingId === t.id ? '…' : playingId === t.id ? '■' : '▶'}
              </button>
              <span className="embed-track-title">{t.title}</span>
              {t.durationSec != null && (
                <span className="embed-track-duration">{formatDuration(t.durationSec)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {audioUrl && (
        <audio key={audioUrl} src={audioUrl} controls autoPlay className="embed-audio" />
      )}

      {error && (
        <Text as="p" className="embed-error">
          {error}
        </Text>
      )}
    </div>
  )
}
