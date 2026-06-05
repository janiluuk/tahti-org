// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SmartLinkPageLayout, SafePlainText } from '@tahti/ui'

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
    <SmartLinkPageLayout>
      {data.release.artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.release.artworkUrl}
          alt=""
          className="sl-cover-art"
          width={160}
          height={160}
        />
      )}
      <h1 className="sl-title-h2">{data.release.title}</h1>
      <p className="sl-title-meta">
        {data.artist.displayName} · {data.release.type}
      </p>
      <p className="sl-title-meta">{new Date(data.release.releaseDate).toLocaleDateString()}</p>

      {data.release.description && (
        <SafePlainText text={data.release.description} className="sl-artist-quote" />
      )}

      {(data.release.upc ||
        data.release.pLine ||
        data.release.cLine ||
        tracksWithIsrc.length > 0 ||
        data.release.musicbrainzUrl) && (
        <div className="sl-panel">
          {data.release.upc && (
            <div className="sl-panel-row">
              <strong>UPC:</strong> {data.release.upc}
            </div>
          )}
          {data.release.pLine && <div className="sl-panel-row">{data.release.pLine}</div>}
          {data.release.cLine && <div className="sl-panel-row">{data.release.cLine}</div>}
          {tracksWithIsrc.length > 0 && (
            <ul className="sl-track-list">
              {tracksWithIsrc.map((track) => (
                <li key={track.position}>
                  {track.title}: {track.isrc}
                </li>
              ))}
            </ul>
          )}
          {data.release.musicbrainzUrl && (
            <div className="sl-panel-action">
              <a href={data.release.musicbrainzUrl}>View on MusicBrainz</a>
            </div>
          )}
        </div>
      )}

      {data.featuredCollections && data.featuredCollections.length > 0 && (
        <div className="sl-panel">
          <p className="sl-collection-label">From this artist</p>
          <ul className="sl-collection-list">
            {data.featuredCollections.map((c) => (
              <li key={c.slug} className="sl-collection-item">
                <Link href={c.url} className="sl-collection-link">
                  {c.name}
                </Link>
                <span className="sl-collection-meta"> · {c.itemCount} item(s)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {services.length > 0 ? (
        <div className="sl-btns">
          {services.map(([key, url]) => (
            <a key={key} href={url} rel="noopener noreferrer" className="sl-btn">
              <span className="sl-btn-name">{SERVICE_LABELS[key] ?? key}</span>
              <span className="sl-btn-arrow">→</span>
            </a>
          ))}
        </div>
      ) : (
        <Link href={data.releaseUrl} className="sl-primary-cta">
          Listen on Tahti
        </Link>
      )}

      <p className="sl-footer">
        <Link href={data.profileUrl}>@{data.artist.username}</Link>
        {' · '}
        <a href={data.embedUrl}>Embed</a>
      </p>
    </SmartLinkPageLayout>
  )
}
