// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Gives every channel currently missing an avatar a generated colorful
 * placeholder (gradient + centered initials), so the public channel
 * directory (/api/v1/channels/directory) isn't a wall of blank
 * initials-fallback circles. Idempotent: only fills User.avatarUrl where
 * it's currently null — never overwrites a real uploaded avatar.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/seed-directory-avatars.ts
 */

import { prisma } from '@tahti/db'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import { generateAvatarSvg } from '../src/lib/generate-cover-art.js'

async function main() {
  const users = await prisma.user.findMany({
    where: { channel: { isNot: null }, avatarUrl: null, deletedAt: null },
    select: { id: true, username: true, displayName: true },
  })

  const results: Array<{ username: string; avatarUrl: string }> = []
  for (const u of users) {
    const key = `avatars/${u.username}/generated-cover.svg`
    await putObjectText(
      key,
      generateAvatarSvg(u.username, u.displayName ?? u.username),
      'image/svg+xml',
    )
    const avatarUrl = publicMediaUrl(key)!
    await prisma.user.update({ where: { id: u.id }, data: { avatarUrl } })
    results.push({ username: u.username, avatarUrl })
  }

  console.log(JSON.stringify({ ok: true, updated: results.length, results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
