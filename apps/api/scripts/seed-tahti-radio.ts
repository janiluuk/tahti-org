// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Idempotent seed for the Tahti Radio channel (chat + reactions on /radio).
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/seed-tahti-radio.ts
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { hashPassword } from '../src/lib/password.js'

const RADIO_EMAIL = 'tahti-radio@system.tahti.live'

async function main() {
  const passwordHash = await hashPassword(randomBytes(32).toString('hex'))
  const streamPass = randomBytes(16).toString('hex')
  const streamKey = `${TAHTI_RADIO_SLUG}__${randomBytes(8).toString('hex')}`

  const user = await prisma.user.upsert({
    where: { username: TAHTI_RADIO_SLUG },
    create: {
      email: RADIO_EMAIL,
      passwordHash,
      username: TAHTI_RADIO_SLUG,
      displayName: 'Tahti Radio',
      emailVerifiedAt: new Date(),
      isMember: true,
      channel: {
        create: {
          slug: TAHTI_RADIO_SLUG,
          state: 'LIVE',
          liveSourceMount: `/live/${TAHTI_RADIO_SLUG}`,
          liveSourcePass: streamPass,
          liveSourcePassHash: await hashPassword(streamPass),
          rtmpStreamKey: streamKey,
          rtmpStreamKeyHash: await hashPassword(streamKey),
          nextBroadcastNote: '24/7 community radio — chat with listeners worldwide.',
        },
      },
    },
    update: {
      displayName: 'Tahti Radio',
    },
    include: { channel: true },
  })

  if (!user.channel) {
    await prisma.channel.create({
      data: {
        userId: user.id,
        slug: TAHTI_RADIO_SLUG,
        state: 'LIVE',
        liveSourceMount: `/live/${TAHTI_RADIO_SLUG}`,
        liveSourcePass: streamPass,
        liveSourcePassHash: await hashPassword(streamPass),
        rtmpStreamKey: streamKey,
        rtmpStreamKeyHash: await hashPassword(streamKey),
        nextBroadcastNote: '24/7 community radio — chat with listeners worldwide.',
      },
    })
  } else if (user.channel.state !== 'LIVE') {
    await prisma.channel.update({
      where: { id: user.channel.id },
      data: { state: 'LIVE' },
    })
  }

  console.log(JSON.stringify({ ok: true, slug: TAHTI_RADIO_SLUG }))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
