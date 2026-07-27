// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds/resets a deterministic artist fixture for the RTMP-preview-then-go-live
 * e2e journey (tests/e2e/rtmp-preview-go-live.mjs). Self-contained.
 *
 * Usage (from apps/api, DATABASE_URL pointed at the target Postgres):
 *   npx tsx scripts/seed-e2e-golive.ts
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

export const E2E_PASS = 'e2e-golive-pass'

export const GOLIVE_ARTIST = {
  email: 'e2e-golive-artist@e2e.tahti.live',
  username: 'e2e-golive-artist',
  displayName: 'E2E Go-Live Artist',
}

/** The `__` split is load-bearing — apps/api/src/routes/internal/rtmp.ts looks
 * up the channel by `streamName.split('__')[0]`. */
export const RTMP_STREAM_KEY = `${GOLIVE_ARTIST.username}__e2egolive`

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: GOLIVE_ARTIST.email },
    include: { channel: true },
  })

  const rtmpStreamKeyHash = await hashPassword(RTMP_STREAM_KEY)
  const channelData = {
    slug: GOLIVE_ARTIST.username,
    liveSourceMount: `/live/${GOLIVE_ARTIST.username}`,
    liveSourcePass: `${GOLIVE_ARTIST.username}-pass`,
    liveSourcePassHash: await hashPassword(`${GOLIVE_ARTIST.username}-pass`),
    rtmpStreamKey: RTMP_STREAM_KEY,
    rtmpStreamKeyHash,
    state: 'OFFLINE' as const,
    goneLiveAt: null,
  }

  if (existing?.channel) {
    await prisma.channel.update({ where: { id: existing.channel.id }, data: channelData })
  } else if (existing) {
    await prisma.channel.create({ data: { ...channelData, userId: existing.id } })
  } else {
    await prisma.user.create({
      data: {
        email: GOLIVE_ARTIST.email,
        passwordHash: await hashPassword(E2E_PASS),
        username: GOLIVE_ARTIST.username,
        displayName: GOLIVE_ARTIST.displayName,
        emailVerifiedAt: new Date(),
        tier: 'FREE',
        membership: { create: { status: 'PENDING_PAYMENT' } },
        channel: { create: channelData },
      },
    })
  }

  console.log(
    JSON.stringify({
      ok: true,
      email: GOLIVE_ARTIST.email,
      username: GOLIVE_ARTIST.username,
      password: E2E_PASS,
      rtmpStreamKey: RTMP_STREAM_KEY,
    }),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
