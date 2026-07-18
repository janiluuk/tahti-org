// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Idempotent: gives the Tahti Radio channel its own curated-rotation fallback
 * (mirrors Tahti Selects' CuratedRotationItem rows, referencing the same
 * archive items — no audio is duplicated, just the join-table rows Liquidsoap's
 * fallback.m3u lookup reads per-channelId) and bumps its tier to STUDIO so it's
 * exempt from the free-tier weekly live-broadcast cap — the same fix Tahti
 * Selects needed once it actually started running a live Liquidsoap process
 * (see docs/history: FREE_WEEKLY_HARD_CAP_SEC force-disconnect after ~61min).
 *
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/seed-tahti-radio-rotation.ts
 */

import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG } from '@tahti/shared'

async function main() {
  const [radio, selects] = await Promise.all([
    prisma.channel.findUnique({
      where: { slug: TAHTI_RADIO_SLUG },
      select: { id: true, userId: true },
    }),
    prisma.channel.findUnique({
      where: { slug: TAHTI_SELECTS_SLUG },
      select: {
        id: true,
        curatedRotationItems: {
          orderBy: { position: 'asc' },
          select: { archiveItemId: true, position: true, addedById: true },
        },
      },
    }),
  ])

  if (!radio) throw new Error('Tahti Radio channel not found — run seed-tahti-radio.ts first')
  if (!selects) {
    throw new Error('Tahti Selects channel not found — run seed-tahti-selects-content.ts first')
  }

  await prisma.user.update({
    where: { id: radio.userId },
    data: { tier: 'STUDIO' },
  })

  for (const item of selects.curatedRotationItems) {
    await prisma.curatedRotationItem.upsert({
      where: {
        channelId_archiveItemId: { channelId: radio.id, archiveItemId: item.archiveItemId },
      },
      create: {
        channelId: radio.id,
        archiveItemId: item.archiveItemId,
        position: item.position,
        addedById: item.addedById,
      },
      update: { position: item.position },
    })
  }

  console.log(
    JSON.stringify({
      ok: true,
      slug: TAHTI_RADIO_SLUG,
      tracks: selects.curatedRotationItems.length,
    }),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
