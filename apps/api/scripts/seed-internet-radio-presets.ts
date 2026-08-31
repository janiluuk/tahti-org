// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds the starter internet radio preset catalog. Stream/icon URLs are left
 * blank deliberately — an admin fills them in via /admin/internet-radio once
 * confirmed, rather than this script guessing broadcaster endpoints.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/seed-internet-radio-presets.ts
 */

import { prisma } from '@tahti/db'

const PRESETS = [
  {
    name: 'YleX',
    genre: 'Pop / Hits',
    description: 'Finnish youth-focused pop and hits station.',
    iconUrl: 'https://img.img-cdn.yle.fi/crop_limit,w_640/ylex_vt',
  },
  {
    name: 'Radio Helsinki',
    genre: 'Talk / Variety',
    description: 'Helsinki-area talk and variety station.',
    iconUrl: 'https://www.streamurl.link/logos/JoiOnv3Q9An.webp',
  },
  {
    name: 'Radio Rock',
    genre: 'Rock',
    description: 'Finnish rock radio station.',
    iconUrl:
      'https://img.nm-ovp.nelonenmedia.fi/v1/novelist?src=%2Ffiles%2Fmisc_images%2F2024-08%2FRadioRock_2560x2560.jpg',
  },
]

async function main() {
  const results = []
  for (const preset of PRESETS) {
    const existing = await prisma.internetRadioPreset.findFirst({ where: { name: preset.name } })
    const row = existing
      ? await prisma.internetRadioPreset.update({ where: { id: existing.id }, data: preset })
      : await prisma.internetRadioPreset.create({ data: preset })
    results.push({ id: row.id, name: row.name })
  }
  console.log(JSON.stringify({ ok: true, seeded: results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
