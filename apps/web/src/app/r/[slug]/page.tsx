// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SafePlainText } from '@/components/safe-plain-text'

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

interface SmartLinkTrack {
  title: string
  isrc: string | null
  position: number
}

interface FeaturedCollection {
  slug: string
  name: string
  type: string
  description: string | null
  itemCount: number
  url: string
}

interface SmartLinkResponse {
  release: {
    id: string
    title: string
    type: string
    releaseDate: string
    artworkUrl: string | null
    description: string | null
    upc: string | null
    pLine: string | null
    cLine: string | null
    tracks: SmartLinkTrack[]
    musicbrainzUrl: string | null
  }
  artist: { username: string; displayName: string; avatarUrl: string | null }
  featuredCollections?: FeaturedCollection[]
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
  const tracksWithIsrc = data.release.tracks.filter((t) => t.isrc?.trim())

  return (
    <>
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
      <p className="brand-muted" style={{ margin: '0 0 0.5rem' }}>
        {data.artist.displayName} · {data.release.type}
      </p>
      <p className="brand-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {new Date(data.release.releaseDate).toLocaleDateString()}
      </p>
      {data.release.description && (
        <SafePlainText
          text={data.release.description}
          style={{ lineHeight: 1.5, marginBottom: '1.5rem' }}
        />
      )}

      {(data.release.upc ||
        data.release.pLine ||
        data.release.cLine ||
        tracksWithIsrc.length > 0 ||
        data.release.musicbrainzUrl) && (
        <div className="brand-panel">
          {data.release.upc && (
            <div style={{ marginBottom: '0.35rem' }}>
              <strong>UPC:</strong> {data.release.upc}
            </div>
          )}
          {data.release.pLine && (
            <div style={{ marginBottom: '0.35rem' }}>{data.release.pLine}</div>
          )}
          {data.release.cLine && (
            <div style={{ marginBottom: '0.35rem' }}>{data.release.cLine}</div>
          )}
          {tracksWithIsrc.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              {tracksWithIsrc.map((track) => (
                <li key={track.position}>
                  {track.title}: {track.isrc}
                </li>
              ))}
            </ul>
          )}
          {data.release.musicbrainzUrl && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={data.release.musicbrainzUrl}>View on MusicBrainz</a>
            </div>
          )}
        </div>
      )}

      {data.featuredCollections && data.featuredCollections.length > 0 && (
        <div className="brand-panel">
          <p className="brand-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
            From this artist
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.featuredCollections.map((c) => (
              <li key={c.slug} style={{ marginBottom: '0.35rem' }}>
                <Link href={c.url} style={{ fontWeight: 600 }}>
                  {c.name}
                </Link>
                <span className="brand-muted" style={{ fontSize: '0.8rem' }}>
                  {' '}
                  · {c.itemCount} item(s)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {services.length > 0 ? (
        <div className="brand-cta-row">
          {services.map(([key, url]) => (
            <a key={key} href={url} rel="noopener noreferrer" className="brand-cta-dark">
              {SERVICE_LABELS[key] ?? key}
            </a>
          ))}
        </div>
      ) : (
        <Link href={data.releaseUrl} className="brand-cta">
          Listen on Tahti
        </Link>
      )}

      <p className="brand-muted" style={{ marginTop: '2rem', fontSize: '0.85rem' }}>
        <Link href={data.profileUrl}>@{data.artist.username}</Link>
        {' · '}
        <a href={data.embedUrl}>Embed</a>
      </p>
    </>
  )
}
