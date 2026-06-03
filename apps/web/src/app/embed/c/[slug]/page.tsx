// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import HlsPlayer from '../../../c/[slug]/hls-player'

interface EmbedChannel {
  slug: string
  state: string
  artist: { username: string; displayName: string; avatarUrl: string | null }
  profileUrl: string
  hlsUrl: string | null
}

export default async function ChannelEmbedPage({ params }: { params: { slug: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/embed/c/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const channel = (await res.json()) as EmbedChannel

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}
      >
        {channel.artist.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.artist.avatarUrl}
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: '50%' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{channel.artist.displayName}</div>
          <Link
            href={channel.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#93c5fd', fontSize: '0.8rem' }}
          >
            @{channel.artist.username} on Tahti
          </Link>
        </div>
        {channel.state === 'LIVE' && (
          <span
            style={{
              background: '#dc2626',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: 4,
            }}
          >
            LIVE
          </span>
        )}
      </div>

      {channel.hlsUrl ? (
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '0.5rem' }}>
          <HlsPlayer url={channel.hlsUrl} />
        </div>
      ) : (
        <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.85rem' }}>
          Not live right now —{' '}
          <Link href={channel.profileUrl} style={{ color: '#93c5fd' }}>
            visit the channel
          </Link>
        </p>
      )}
    </div>
  )
}
