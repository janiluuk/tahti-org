// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Gives every sound, collection and channel owner that has no cover art an
 * enabled artwork preset (see lib/artwork-presets.ts). Only rows with no
 * cover at all are touched, so an owner's own image is never replaced, and
 * re-running only picks up rows still missing one.
 *
 * Run:
 *   docker compose exec api tsx apps/api/scripts/backfill-preset-covers.ts --dry-run
 *   docker compose exec api tsx apps/api/scripts/backfill-preset-covers.ts
 */

import { prisma } from '@tahti/db'
import { assignPresetCovers, enabledArtworkPresetUrls } from '../src/lib/artwork-presets.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 500

async function backfill(
  kind: 'sound' | 'collection' | 'avatar',
  nextIds: (cursor: string | undefined) => Promise<string[]>,
): Promise<number> {
  let total = 0
  let cursor: string | undefined
  for (;;) {
    const ids = await nextIds(cursor)
    if (ids.length === 0) return total
    total += DRY_RUN ? ids.length : await assignPresetCovers(prisma, kind, ids)
    cursor = ids[ids.length - 1]
  }
}

function after(cursor: string | undefined) {
  return cursor ? { id: { gt: cursor } } : {}
}

const PAGE = { take: BATCH, orderBy: { id: 'asc' as const }, select: { id: true } }

async function main() {
  if ((await enabledArtworkPresetUrls(prisma)).length === 0) {
    console.log('No enabled artwork presets; nothing to assign.')
    return
  }
  const sounds = await backfill('sound', async (cursor) =>
    (await prisma.sound.findMany({ where: { bannerUrl: null, ...after(cursor) }, ...PAGE })).map(
      (r) => r.id,
    ),
  )
  const collections = await backfill('collection', async (cursor) =>
    (
      await prisma.collection.findMany({
        where: { coverUrl: null, coverKey: null, ...after(cursor) },
        ...PAGE,
      })
    ).map((r) => r.id),
  )
  const avatars = await backfill('avatar', async (cursor) =>
    (
      await prisma.user.findMany({
        where: { avatarUrl: null, channel: { isNot: null }, ...after(cursor) },
        ...PAGE,
      })
    ).map((r) => r.id),
  )
  const verb = DRY_RUN ? 'Would assign' : 'Assigned'
  console.log(
    `${verb} preset covers: ${sounds} sounds, ${collections} collections, ${avatars} channel avatars.`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
