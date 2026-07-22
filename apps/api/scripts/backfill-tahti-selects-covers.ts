// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * One-off backfill: generates a gradient SVG cover for any Tahti Selects
 * archive item missing bannerUrl (the original CC0 seed tracks never got one).
 *
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/backfill-tahti-selects-covers.ts
 */

import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'

async function main() {
  const channel = await prisma.channel.findUnique({
    where: { slug: TAHTI_SELECTS_SLUG },
    select: { id: true },
  })
  if (!channel) {
    console.error(JSON.stringify({ ok: false, error: 'tahti-selects channel not found' }))
    process.exit(1)
  }

  const items = await prisma.archiveItem.findMany({
    where: { channelId: channel.id, bannerUrl: null },
    select: { id: true, title: true, commentary: true },
  })

  let updated = 0
  for (const item of items) {
    const artistMatch = item.commentary?.match(/— (.+?)\./)
    const artist = artistMatch ? artistMatch[1]! : 'Tahti Selects'
    const svg = generateCoverArtSvg(item.title, artist)
    const key = `archive/${TAHTI_SELECTS_SLUG}/${item.id}/banner-cover.svg`
    await putObjectText(key, svg, 'image/svg+xml')
    await prisma.archiveItem.update({
      where: { id: item.id },
      data: { bannerUrl: publicMediaUrl(key) },
    })
    updated++
  }

  console.log(JSON.stringify({ ok: true, checked: items.length, updated }))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
