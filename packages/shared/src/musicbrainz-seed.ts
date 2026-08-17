// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * MusicBrainz has no programmatic write API for creating new releases —
 * their OAuth2 scopes (profile/tag/rating/collection/submit_isrc/
 * submit_barcode) don't include one, and new releases go through community
 * edit review either way. The real, documented integration point for
 * third-party apps is "Release Editor Seeding": a pre-filled URL to their
 * own /release/add form, which the artist reviews and submits themselves
 * in their own MusicBrainz account.
 * See: https://musicbrainz.org/doc/Development/Release_Editor_Seeding
 */

export type MusicbrainzSeedTrack = {
  title: string
  durationSec?: number | null
}

export type MusicbrainzSeedRelease = {
  title: string
  artistName: string
  /** Tahti's own ReleaseType — mapped to MusicBrainz's release-group primary type below. */
  type: 'SINGLE' | 'EP' | 'ALBUM' | 'COMPILATION' | 'REMIX'
  releaseDate?: string | Date | null
  upc?: string | null
  tracks: MusicbrainzSeedTrack[]
  /** Link back to the Tahti smart-link/release page, added as a release URL for verification. */
  sourceUrl?: string | null
}

const RELEASE_TYPE_TO_MB: Record<MusicbrainzSeedRelease['type'], string> = {
  SINGLE: 'Single',
  EP: 'EP',
  ALBUM: 'Album',
  COMPILATION: 'Compilation',
  REMIX: 'Album',
}

export function buildMusicbrainzSeedUrl(release: MusicbrainzSeedRelease): string {
  const url = new URL('https://musicbrainz.org/release/add')
  const p = url.searchParams

  p.set('name', release.title)
  p.set('artist_credit.names.0.artist.name', release.artistName)
  p.set('artist_credit.names.0.name', release.artistName)
  p.set('type', RELEASE_TYPE_TO_MB[release.type])

  if (release.releaseDate) {
    const d = new Date(release.releaseDate)
    if (!Number.isNaN(d.getTime())) {
      p.set('events.0.date.year', String(d.getUTCFullYear()))
      p.set('events.0.date.month', String(d.getUTCMonth() + 1))
      p.set('events.0.date.day', String(d.getUTCDate()))
    }
  }

  if (release.upc) p.set('barcode', release.upc)

  p.set('mediums.0.format', 'Digital Media')
  release.tracks.forEach((t, i) => {
    p.set(`mediums.0.track.${i}.name`, t.title)
    if (t.durationSec) {
      p.set(`mediums.0.track.${i}.length`, String(Math.round(t.durationSec * 1000)))
    }
  })

  if (release.sourceUrl) {
    p.set('urls.0.url', release.sourceUrl)
    // "stream for free" link type — closest documented fit for a Tahti smart-link/release page.
    p.set('urls.0.link_type', '980')
  }

  return url.toString()
}
