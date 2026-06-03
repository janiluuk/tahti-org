// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { ReleaseCatalogPatchSchema } from '@tahti/shared'

export const releaseCatalogSelect = {
  id: true,
  title: true,
  type: true,
  state: true,
  releaseDate: true,
  description: true,
  artworkUrl: true,
  smartLinkSlug: true,
  smartLinkTargets: true,
  upc: true,
  musicbrainzReleaseId: true,
  musicbrainzArtistId: true,
  pLine: true,
  cLine: true,
  labelImprint: true,
  credits: true,
  revelatorId: true,
  revelatorStatus: true,
  publishedAt: true,
  tracks: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      title: true,
      isrc: true,
      musicbrainzRecordingId: true,
      durationSec: true,
    },
  },
} as const

export function catalogPatchFromBody(
  body: unknown,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const parsed = ReleaseCatalogPatchSchema.safeParse(body)
  if (!parsed.success) return { ok: false, error: 'Invalid catalog fields' }

  const data: Record<string, unknown> = {}
  const f = parsed.data
  if (f.upc !== undefined) data.upc = f.upc?.trim() || null
  if (f.musicbrainzReleaseId !== undefined)
    data.musicbrainzReleaseId = f.musicbrainzReleaseId?.trim() || null
  if (f.musicbrainzArtistId !== undefined)
    data.musicbrainzArtistId = f.musicbrainzArtistId?.trim() || null
  if (f.pLine !== undefined) data.pLine = f.pLine?.trim() || null
  if (f.cLine !== undefined) data.cLine = f.cLine?.trim() || null
  if (f.labelImprint !== undefined) data.labelImprint = f.labelImprint?.trim() || null
  if (f.credits !== undefined) data.credits = f.credits
  if (Object.keys(data).length === 0) return { ok: false, error: 'No catalog fields to update' }
  return { ok: true, data }
}

export function buildReleaseExportPack(release: {
  title: string
  type: string
  releaseDate: Date
  description: string | null
  upc: string | null
  musicbrainzReleaseId: string | null
  musicbrainzArtistId: string | null
  pLine: string | null
  cLine: string | null
  labelImprint: string | null
  credits: unknown
  smartLinkSlug: string
  tracks: Array<{
    position: number
    title: string
    isrc: string | null
    musicbrainzRecordingId: string | null
    durationSec: number | null
  }>
  user: { username: string; displayName: string }
}) {
  return {
    exportedAt: new Date().toISOString(),
    artist: { username: release.user.username, displayName: release.user.displayName },
    release: {
      title: release.title,
      type: release.type,
      releaseDate: release.releaseDate.toISOString(),
      description: release.description,
      upc: release.upc,
      musicbrainzReleaseId: release.musicbrainzReleaseId,
      musicbrainzArtistId: release.musicbrainzArtistId,
      pLine: release.pLine,
      cLine: release.cLine,
      labelImprint: release.labelImprint,
      credits: release.credits,
      smartLinkSlug: release.smartLinkSlug,
    },
    tracks: release.tracks.map((t) => ({
      position: t.position,
      title: t.title,
      isrc: t.isrc,
      musicbrainzRecordingId: t.musicbrainzRecordingId,
      durationSec: t.durationSec,
    })),
  }
}
