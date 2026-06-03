// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'

const SERVICE_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  tidal: 'Tidal',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube Music',
  deezer: 'Deezer',
  amazon: 'Amazon Music',
}

interface SmartLinkResponse {
  release: {
    id: string
    title: string
    type: string
    releaseDate: string
    artworkUrl: string | null
    description: string | null
  }
  artist: { username: string; displayName: string; avatarUrl: string | null }
  profileUrl: string
  releaseUrl: string
  targets: Record<string, string>
  embedUrl: string
}

export default async function SmartLinkPage({ params }: { params: { slug: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/r/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const data = (await res.json()) as SmartLinkResponse

  const services = Object.entries(data.targets).filter(([, url]) => url?.trim())

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '3rem auto',
        padding: '0 1.5rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      {data.release.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.release.artworkUrl}
          alt=""
          width={200}
          height={200}
          style={{ borderRadius: 12, objectFit: 'cover', marginBottom: '1.5rem' }}
        />
      )}
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem' }}>{data.release.title}</h1>
      <p style={{ color: '#666', margin: '0 0 0.5rem' }}>
        {data.artist.displayName} · {data.release.type}
      </p>
      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {new Date(data.release.releaseDate).toLocaleDateString()}
      </p>
      {data.release.description && (
        <p style={{ color: '#444', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          {data.release.description}
        </p>
      )}

      {services.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {services.map(([key, url]) => (
            <a
              key={key}
              href={url}
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#111',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              {SERVICE_LABELS[key] ?? key}
            </a>
          ))}
        </div>
      ) : (
        <Link
          href={data.releaseUrl}
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.25rem',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Listen on Tahti
        </Link>
      )}

      <p style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
        <Link href={data.profileUrl} style={{ color: '#2563eb' }}>
          @{data.artist.username}
        </Link>
        {' · '}
        <a href={data.embedUrl} style={{ color: '#2563eb' }}>
          Embed
        </a>
      </p>
    </div>
  )
}
