// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notifyFollowersOfNewTrack, type PrismaClient } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'

/** True for a sound that has never been READY: no version 1 yet and not
 * READY when the job started. Retries after a failed first attempt still
 * count; re-transcodes of a finished track don't. */
export async function isFirstTranscode(
  prisma: PrismaClient,
  soundId: string,
  statusAtStart: string,
): Promise<boolean> {
  if (statusAtStart === 'READY') return false
  return (await prisma.soundVersion.count({ where: { soundId } })) === 0
}

/** Tells the artist's followers about a track that went READY while already
 * public — uploads start public, so the API's private → public fan-out in
 * PATCH /api/me/sound/:id never runs for them. */
export async function announceNewPublicTrack(prisma: PrismaClient, soundId: string): Promise<void> {
  const sound = await prisma.sound.findUnique({
    where: { id: soundId },
    select: {
      id: true,
      title: true,
      isPublic: true,
      status: true,
      channel: { select: { user: { select: { id: true, username: true, displayName: true } } } },
    },
  })
  if (!sound || !sound.isPublic || sound.status !== 'READY') return
  const artist = sound.channel.user
  await notifyFollowersOfNewTrack(
    prisma,
    { ...artist, displayName: safeDisplayName(artist.displayName, artist.username) },
    { id: sound.id, title: sound.title },
  )
}
