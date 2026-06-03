// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import type { TracklistEntry } from '@tahti/shared'
import { TracklistEntrySchema } from '@tahti/shared'
import { recordMentions } from './mentions.js'

export async function normalizeTracklist(
  prisma: PrismaClient,
  entries: TracklistEntry[],
): Promise<TracklistEntry[]> {
  const parsed = entries.map((e, i) => {
    const row = TracklistEntrySchema.parse(e)
    if (i > 0 && row.startSec < entries[i - 1]!.startSec) {
      throw new Error('Tracklist timestamps must be non-decreasing')
    }
    return row
  })

  const normalized: TracklistEntry[] = []
  for (const row of parsed) {
    let artistUsername = row.artistUsername?.toLowerCase()
    let artist = row.artist
    if (artistUsername) {
      const user = await prisma.user.findFirst({
        where: { username: { equals: artistUsername, mode: 'insensitive' } },
        select: { username: true, displayName: true },
      })
      if (!user) {
        throw new Error(`Unknown Tahti artist @${artistUsername}`)
      }
      artistUsername = user.username.toLowerCase()
      if (!artist?.trim()) artist = user.displayName
    }
    normalized.push({
      startSec: row.startSec,
      title: row.title,
      ...(artist?.trim() ? { artist: artist.trim() } : {}),
      ...(artistUsername ? { artistUsername } : {}),
    })
  }
  return normalized
}

export async function recordTracklistMentions(
  prisma: PrismaClient,
  mentionerUserId: string,
  tracklist: TracklistEntry[],
  archiveItemId: string,
): Promise<void> {
  const handles = [
    ...new Set(
      tracklist.map((e) => e.artistUsername?.toLowerCase()).filter((h): h is string => Boolean(h)),
    ),
  ]
  if (handles.length === 0) return
  const text = handles.map((h) => `@${h}`).join(' ')
  await recordMentions(prisma, mentionerUserId, text, 'TRACKLIST', archiveItemId)
}

export function formatTracklistTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
