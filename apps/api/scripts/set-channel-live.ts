// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
// Sets the screenshot-demo channel to LIVE for demo screenshots.
// Run: docker compose exec api tsx apps/api/scripts/set-channel-live.ts <slug>

import { prisma } from '@tahti/db'

const slug = process.argv[2] ?? 'screenshot-demo'

await prisma.channel.update({
  where: { slug },
  data: { state: 'LIVE', goneLiveAt: new Date() },
})
console.log(`Channel @${slug} set to LIVE`)
await prisma.$disconnect()
