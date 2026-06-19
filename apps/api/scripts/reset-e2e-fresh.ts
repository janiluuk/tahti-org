// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Reset the fresh-artist e2e account to verified, no channel, no releases.
 * Run inside stack: docker compose run --rm api tsx apps/api/scripts/reset-e2e-fresh.ts
 */

import { prisma } from '@tahti/db'

const FRESH_EMAIL = 'screenshot-fresh@e2e.tahti.live'

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: FRESH_EMAIL },
    select: { id: true, channel: { select: { id: true } } },
  })
  if (!user) {
    console.log(
      JSON.stringify({ reset: false, reason: 'user missing — run seed-e2e-screenshots.ts' }),
    )
    return
  }

  if (user.channel) {
    await prisma.download.deleteMany({ where: { channelId: user.channel.id } })
    await prisma.archiveItem.deleteMany({ where: { channelId: user.channel.id } })
    await prisma.channel.delete({ where: { id: user.channel.id } })
  }

  await prisma.release.deleteMany({ where: { userId: user.id } })
  await prisma.collection.deleteMany({ where: { userId: user.id } })
  await prisma.stashFile.deleteMany({ where: { userId: user.id } })

  console.log(JSON.stringify({ reset: true, email: FRESH_EMAIL }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
