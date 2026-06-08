// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SmartLinkPageLayout, SafePlainText } from '@tahti/ui'
import { SmartLinkDspButtons } from '@/components/smart-link-dsp-buttons'

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
    discogsUrl: string | null
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

  const tracksWithIsrc = data.release.tracks.filter((t) => t.isrc?.trim())

  const year = new Date(data.release.releaseDate).getFullYear()
  const trackCount = data.release.tracks.length

  return (
    <SmartLinkPageLayout>
      {data.release.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.release.artworkUrl}
          alt=""
          className="sl-cover-art"
          width={280}
          height={280}
        />
      ) : (
        <div className="sl-cover-ph sl-cover-ph--aurora" aria-hidden />
      )}
      <h1 className="sl-title-h2">{data.release.title}</h1>
      <p className="sl-title-meta">
        {data.artist.displayName} · {data.release.type}
        {trackCount > 0 && ` · ${trackCount} track${trackCount !== 1 ? 's' : ''}`}
        {' · '}{year}
      </p>

      {data.release.description && (
        <SafePlainText text={data.release.description} className="sl-artist-quote" linkMentions />
      )}

      {(data.release.upc ||
        data.release.pLine ||
        data.release.cLine ||
        tracksWithIsrc.length > 0 ||
        data.release.musicbrainzUrl ||
        data.release.discogsUrl) && (
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
          {data.release.discogsUrl && (
            <div className="sl-panel-action">
              <a href={data.release.discogsUrl}>View on Discogs</a>
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

      <SmartLinkDspButtons smartLinkSlug={params.slug} targets={data.targets} />

      {Object.keys(data.targets).filter((k) => data.targets[k]?.trim()).length === 0 && (
        <Link href={data.releaseUrl} className="sl-primary-cta">
          Listen on Tahti
        </Link>
      )}

      <p className="sl-footer">
        Powered by <a href="https://tahti.live">tahti.live</a>
        {' · '}
        <Link href={data.profileUrl}>@{data.artist.username}</Link>
      </p>
    </SmartLinkPageLayout>
  )
}
