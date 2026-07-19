// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds/resets deterministic fixtures for the artist-posts-and-radio e2e journey
 * (tests/e2e/artist-posts-and-radio.mjs). Self-contained — does not depend on
 * seed-e2e-screenshots.ts fixtures.
 *
 * Usage (from apps/api, DATABASE_URL pointed at the target Postgres):
 *   npx tsx scripts/seed-e2e-posts-radio.ts posts
 *   npx tsx scripts/seed-e2e-posts-radio.ts radio-slot <offsetMin> <durationMin> [note]
 *   npx tsx scripts/seed-e2e-posts-radio.ts radio-clear
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

export const E2E_PASS = 'e2e-posts-radio-pass'

export const STORIES_ARTIST = {
  email: 'e2e-stories-artist@e2e.tahti.live',
  username: 'e2e-stories-artist',
  displayName: 'E2E Stories Artist',
}

export const RADIO_ARTIST = {
  email: 'e2e-radio-artist@e2e.tahti.live',
  username: 'e2e-radio-dj',
  displayName: 'E2E Radio DJ',
}

interface ArtistSpec {
  email: string
  username: string
  displayName: string
}

async function ensureArtist(spec: ArtistSpec): Promise<{ id: string; channel: { id: string } }> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    include: { channel: true },
  })
  if (existing?.channel) return { id: existing.id, channel: { id: existing.channel.id } }

  const channelData = {
    slug: spec.username,
    liveSourceMount: `/live/${spec.username}`,
    liveSourcePass: `${spec.username}-pass`,
    liveSourcePassHash: await hashPassword(`${spec.username}-pass`),
    rtmpStreamKey: `${spec.username}__e2e`,
    rtmpStreamKeyHash: await hashPassword(`${spec.username}__e2e`),
  }

  if (existing) {
    // User row exists but channel is missing (partial prior run) — attach one.
    const channel = await prisma.channel.create({ data: { ...channelData, userId: existing.id } })
    return { id: existing.id, channel: { id: channel.id } }
  }

  const passwordHash = await hashPassword(E2E_PASS)
  const created = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash,
      username: spec.username,
      displayName: spec.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      membership: { create: { status: 'PENDING_PAYMENT' } },
      channel: { create: channelData },
    },
    include: { channel: true },
  })
  return { id: created.id, channel: { id: created.channel!.id } }
}

async function seedPosts() {
  const artist = await ensureArtist(STORIES_ARTIST)
  await prisma.artistPost.deleteMany({ where: { userId: artist.id } })

  const now = Date.now()
  await prisma.artistPost.create({
    data: {
      userId: artist.id,
      title: 'Older post',
      body: 'This is an older post — should only appear in the Updates list, not featured.',
      publishAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  })
  await prisma.artistPost.create({
    data: {
      userId: artist.id,
      title: 'Latest drop',
      body: 'This is the newest published post — should be featured at the top of the profile.',
      publishAt: new Date(now - 60 * 1000),
    },
  })
  await prisma.artistPost.create({
    data: {
      userId: artist.id,
      title: 'Secret future post',
      body: 'Scheduled for the future — must not be visible on any public page yet.',
      publishAt: new Date(now + 60 * 60 * 1000),
    },
  })

  console.log(
    JSON.stringify({
      ok: true,
      email: STORIES_ARTIST.email,
      username: STORIES_ARTIST.username,
      password: E2E_PASS,
    }),
  )
}

async function seedRadioSlot(offsetMin: number, durationMin: number, note?: string) {
  const artist = await ensureArtist(RADIO_ARTIST)
  await prisma.radioSlotBooking.deleteMany({ where: { channelId: artist.channel.id } })

  const startAt = new Date(Date.now() + offsetMin * 60 * 1000)
  const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000)
  await prisma.radioSlotBooking.create({
    data: { channelId: artist.channel.id, startAt, endAt, note: note || null },
  })

  console.log(
    JSON.stringify({
      ok: true,
      username: RADIO_ARTIST.username,
      displayName: RADIO_ARTIST.displayName,
      startAt,
      endAt,
      note: note || null,
    }),
  )
}

async function clearRadioSlots() {
  const artist = await ensureArtist(RADIO_ARTIST)
  await prisma.radioSlotBooking.deleteMany({ where: { channelId: artist.channel.id } })
  console.log(JSON.stringify({ ok: true, cleared: true }))
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'posts') {
    await seedPosts()
  } else if (mode === 'radio-slot') {
    const offsetMin = Number(process.argv[3])
    const durationMin = Number(process.argv[4])
    if (Number.isNaN(offsetMin) || Number.isNaN(durationMin)) {
      throw new Error('radio-slot requires <offsetMin> <durationMin> [note]')
    }
    await seedRadioSlot(offsetMin, durationMin, process.argv[5])
  } else if (mode === 'radio-clear') {
    await clearRadioSlots()
  } else {
    throw new Error(`unknown mode "${mode}" — expected posts | radio-slot | radio-clear`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
