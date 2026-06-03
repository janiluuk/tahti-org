// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'

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
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {release.artworkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={release.artworkUrl}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: 6, objectFit: 'cover' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{release.title}</div>
          <Link
            href={release.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#93c5fd', fontSize: '0.8rem' }}
          >
            {release.artist.displayName} on Tahti
          </Link>
        </div>
      </div>

      {playable.length === 0 ? (
        <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.85rem' }}>No playable tracks yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {playable.map((t) => (
            <li
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0',
                borderTop: '1px solid #262626',
              }}
            >
              <button
                type="button"
                onClick={() => playTrack(t)}
                disabled={loadingId === t.id}
                aria-label={`Play ${t.title}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: playingId === t.id ? '#2563eb' : '#374151',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  flexShrink: 0,
                }}
              >
                {loadingId === t.id ? '…' : playingId === t.id ? '■' : '▶'}
              </button>
              <span
                style={{
                  flex: 1,
                  fontSize: '0.85rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t.title}
              </span>
              {t.durationSec != null && (
                <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                  {formatDuration(t.durationSec)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {audioUrl && (
        <audio
          key={audioUrl}
          src={audioUrl}
          controls
          autoPlay
          style={{ width: '100%', marginTop: '0.75rem' }}
        />
      )}

      {error && (
        <p style={{ color: '#fca5a5', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{error}</p>
      )}
    </div>
  )
}
