// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'

const MAX_PER_ARTIST = 3
const MAX_TOTAL = 50
/** Auto-picks sit after any admin-curated rows (which start at 0). */
const POSITION_BASE = 10_000

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Weekly re-draw of the Tahti Selects rotation from every artist-opted-in track
 * system-wide: up to 3 tracks per artist, up to 50 total, shuffled. Auto-picked
 * rows are tagged addedById = the Tahti Selects system user, so this only ever
 * touches its own prior picks — admin-curated rows (added via /admin/tahti-selects)
 * are a different addedById and are left alone. */
export async function processTahtiSelectsDrawJob(
  prisma: PrismaClient,
): Promise<{ picked: number; artists: number }> {
  const channel = await prisma.channel.findUnique({
    where: { slug: TAHTI_SELECTS_SLUG },
    select: { id: true, userId: true },
  })
  if (!channel) return { picked: 0, artists: 0 }

  const eligible = await prisma.archiveItem.findMany({
    where: {
      selectsOptIn: true,
      status: 'READY',
      isPublic: true,
      channelId: { not: channel.id },
      OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
    },
    select: { id: true, channelId: true },
  })

  const byArtist = new Map<string, string[]>()
  for (const item of eligible) {
    const list = byArtist.get(item.channelId) ?? []
    list.push(item.id)
    byArtist.set(item.channelId, list)
  }

  const picked: string[] = []
  for (const ids of byArtist.values()) {
    picked.push(...shuffle(ids).slice(0, MAX_PER_ARTIST))
  }
  const selected = shuffle(picked).slice(0, MAX_TOTAL)

  await prisma.$transaction([
    prisma.curatedRotationItem.deleteMany({
      where: { channelId: channel.id, addedById: channel.userId },
    }),
    ...selected.map((archiveItemId, i) =>
      prisma.curatedRotationItem.upsert({
        where: { channelId_archiveItemId: { channelId: channel.id, archiveItemId } },
        create: {
          channelId: channel.id,
          archiveItemId,
          position: POSITION_BASE + i,
          addedById: channel.userId,
        },
        update: { position: POSITION_BASE + i, addedById: channel.userId },
      }),
    ),
  ])

  return { picked: selected.length, artists: byArtist.size }
}
