// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { TrackCredit } from '@tahti/shared'

interface SmartLinkTrack {
  title: string
  isrc: string | null
  position: number
}

interface SmartLinkTrackWithCredits {
  title: string
  position: number
  credits?: TrackCredit[] | null
}

interface FeaturedCollection {
  slug: string
  name: string
  itemCount: number
  url: string
}

interface SmartLinkReleaseDetailsProps {
  upc?: string | null
  pLine?: string | null
  cLine?: string | null
  tracksWithIsrc: SmartLinkTrack[]
  tracksWithCredits?: SmartLinkTrackWithCredits[]
  musicbrainzUrl?: string | null
  discogsUrl?: string | null
  featuredCollections?: FeaturedCollection[]
}

export function SmartLinkReleaseDetails({
  upc,
  pLine,
  cLine,
  tracksWithIsrc,
  tracksWithCredits = [],
  musicbrainzUrl,
  discogsUrl,
  featuredCollections,
}: SmartLinkReleaseDetailsProps) {
  const hasCredits =
    upc ||
    pLine ||
    cLine ||
    tracksWithIsrc.length > 0 ||
    tracksWithCredits.length > 0 ||
    musicbrainzUrl ||
    discogsUrl

  return (
    <>
      {hasCredits ? (
        <details className="sl-panel sl-panel--credits">
          <summary className="sl-panel-summary">Credits &amp; IDs</summary>
          {upc ? (
            <div className="sl-panel-row">
              <strong>UPC:</strong> {upc}
            </div>
          ) : null}
          {pLine ? <div className="sl-panel-row">{pLine}</div> : null}
          {cLine ? <div className="sl-panel-row">{cLine}</div> : null}
          {tracksWithIsrc.length > 0 ? (
            <ul className="sl-track-list">
              {tracksWithIsrc.map((track) => (
                <li key={track.position}>
                  {track.title}: {track.isrc}
                </li>
              ))}
            </ul>
          ) : null}
          {tracksWithCredits.length > 0 ? (
            <ul className="sl-track-list">
              {tracksWithCredits.map((track) => (
                <li key={track.position}>
                  {track.title}: {track.credits!.map((c) => `${c.role} — ${c.name}`).join(', ')}
                </li>
              ))}
            </ul>
          ) : null}
          {musicbrainzUrl ? (
            <div className="sl-panel-action">
              <a href={musicbrainzUrl}>View on MusicBrainz</a>
            </div>
          ) : null}
          {discogsUrl ? (
            <div className="sl-panel-action">
              <a href={discogsUrl}>View on Discogs</a>
            </div>
          ) : null}
        </details>
      ) : null}

      {featuredCollections && featuredCollections.length > 0 ? (
        <div className="sl-panel">
          <p className="sl-collection-label">From this artist</p>
          <ul className="sl-collection-list">
            {featuredCollections.map((c) => (
              <li key={c.slug} className="sl-collection-item">
                <Link href={c.url} className="sl-collection-link">
                  {c.name}
                </Link>
                <span className="sl-collection-meta"> · {c.itemCount} item(s)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}
