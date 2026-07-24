// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds two artists + sequential Tahti Radio slot bookings for the live
 * audio / rotation-fallback / auto-record e2e journey
 * (tests/e2e/live-rotation-recording.mjs). Idempotent — reuses existing
 * users/channels by username, refreshes their booking windows to start
 * from "now" on every run.
 *
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/seed-live-rotation-e2e.ts
 *
 * Prints JSON with cleartext Icecast source passwords (never exposed via the
 * public API) and booking window boundaries so the e2e script can drive the
 * exact same windows without re-deriving timing logic.
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

const SLOT_DURATION_MS = 90_000
const GAP_MS = 5_000
// Fixed (not random) so the e2e script can log in as each seeded artist to
// call /api/me/channel/go-live.
const LOGIN_PASSWORD = process.env.E2E_LIVE_TEST_PASSWORD ?? 'e2e-live-rotation-test-password'
// Icecast 2.4.4 hard-requires one shared global <source-password> to accept
// ANY source connection — its per-mount url-auth (on_connect) is not a real
// access-control gate on its own (confirmed: Icecast still accepts a stream
// even when on_connect returns 403). So the per-channel liveSourcePass here
// is deliberately set to the SAME shared secret Icecast is configured with
// (infra/stack/icecast.xml's <source-password>, "dev_source" by default) —
// that's the only way for a pushed stream to satisfy both Icecast's real gate
// and on_connect's per-channel hash check at once, letting this e2e test
// exercise the real app-level flow (Broadcast creation, state transitions,
// relay, recording) rather than just raw bytes hitting a mount Icecast
// happens to accept regardless of the app's opinion.
const ICECAST_SHARED_SOURCE_PASSWORD = process.env.ICECAST_SOURCE_PASSWORD ?? 'dev_source'

interface SeededArtist {
  slug: string
  username: string
  password: string
  liveSourcePass: string
}

async function seedArtist(opts: {
  username: string
  displayName: string
  autoRecordEnabled: boolean
}): Promise<SeededArtist> {
  const passwordHash = await hashPassword(LOGIN_PASSWORD)
  const streamPass = ICECAST_SHARED_SOURCE_PASSWORD
  const streamPassHash = await hashPassword(streamPass)
  const streamKey = `${opts.username}__${randomBytes(8).toString('hex')}`

  const user = await prisma.user.upsert({
    where: { username: opts.username },
    create: {
      email: `${opts.username}@e2e.tahti.live`,
      passwordHash,
      username: opts.username,
      displayName: opts.displayName,
      emailVerifiedAt: new Date(),
      isMember: true,
      tier: 'ARTIST',
      channel: {
        create: {
          slug: opts.username,
          liveSourceMount: `/live/${opts.username}`,
          liveSourcePass: streamPass,
          liveSourcePassHash: streamPassHash,
          rtmpStreamKey: streamKey,
          rtmpStreamKeyHash: await hashPassword(streamKey),
          autoRecordEnabled: opts.autoRecordEnabled,
        },
      },
    },
    update: {},
    include: { channel: true },
  })

  let channel = user.channel
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        userId: user.id,
        slug: opts.username,
        liveSourceMount: `/live/${opts.username}`,
        liveSourcePass: streamPass,
        liveSourcePassHash: streamPassHash,
        rtmpStreamKey: streamKey,
        rtmpStreamKeyHash: await hashPassword(streamKey),
        autoRecordEnabled: opts.autoRecordEnabled,
      },
    })
  } else {
    // Refresh the cleartext pass + hash together so this script's printed
    // password always matches what on_connect will actually verify against,
    // even on repeat runs.
    channel = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        liveSourcePass: streamPass,
        liveSourcePassHash: streamPassHash,
        autoRecordEnabled: opts.autoRecordEnabled,
        state: 'OFFLINE',
        goneLiveAt: null,
        liveSourcePassPreviousHash: null,
        liveSourcePassPreviousExpiresAt: null,
      },
    })
  }

  await prisma.broadcast.deleteMany({ where: { channelId: channel.id, endedAt: null } })

  return {
    slug: channel.slug,
    username: opts.username,
    password: LOGIN_PASSWORD,
    liveSourcePass: streamPass,
  }
}

async function main() {
  const artist1 = await seedArtist({
    username: 'e2e-live-artist-one',
    displayName: 'E2E Live Artist One',
    autoRecordEnabled: true,
  })
  const artist2 = await seedArtist({
    username: 'e2e-live-artist-two',
    displayName: 'E2E Live Artist Two',
    autoRecordEnabled: false,
  })

  const channel1 = await prisma.channel.findUniqueOrThrow({ where: { slug: artist1.slug } })
  const channel2 = await prisma.channel.findUniqueOrThrow({ where: { slug: artist2.slug } })

  // Clear out any stale bookings from a previous run before laying down fresh ones.
  await prisma.radioSlotBooking.deleteMany({
    where: { channelId: { in: [channel1.id, channel2.id] } },
  })

  const slot1Start = new Date(Date.now() + 2_000)
  const slot1End = new Date(slot1Start.getTime() + SLOT_DURATION_MS)
  const slot2Start = new Date(slot1End.getTime() + GAP_MS)
  const slot2End = new Date(slot2Start.getTime() + SLOT_DURATION_MS)

  await prisma.radioSlotBooking.create({
    data: { channelId: channel1.id, startAt: slot1Start, endAt: slot1End, note: 'e2e slot 1' },
  })
  await prisma.radioSlotBooking.create({
    data: { channelId: channel2.id, startAt: slot2Start, endAt: slot2End, note: 'e2e slot 2' },
  })

  console.log(
    JSON.stringify({
      ok: true,
      artist1,
      artist2,
      slot1: { startAt: slot1Start.toISOString(), endAt: slot1End.toISOString() },
      slot2: { startAt: slot2Start.toISOString(), endAt: slot2End.toISOString() },
    }),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
