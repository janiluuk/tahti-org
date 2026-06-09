// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds permanent reference accounts — one per role — for manual QA and demos.
 * Distinct from `seed-e2e-screenshots.ts` (which is throwaway/deterministic for CI screenshots).
 *
 * Run (stack): docker compose exec api tsx apps/api/scripts/seed-demo-accounts.ts
 * Run (host):  cd apps/api && DATABASE_URL=... pnpm dlx tsx scripts/seed-demo-accounts.ts
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

const PASS = 'tahti-demo-pass'

const FREE = {
  email: 'demo-free@tahti.live',
  username: 'demo-free',
  displayName: 'Demo Free Listener',
}
const ARTIST = {
  email: 'demo-artist@tahti.live',
  username: 'demo-artist',
  displayName: 'Demo Artist',
}
const MODERATOR = {
  email: 'demo-moderator@tahti.live',
  username: 'demo-moderator',
  displayName: 'Demo Moderator',
}
const ADMIN = {
  email: 'demo-admin@tahti.live',
  username: 'demo-admin',
  displayName: 'Demo Admin',
}

const ALL = [FREE, ARTIST, MODERATOR, ADMIN]

async function main() {
  const passwordHash = await hashPassword(PASS)

  // Idempotent: wipe any prior run's rows before recreating.
  for (const { email } of ALL) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (!existing) continue
    if (existing.channel) {
      await prisma.channelModerator.deleteMany({ where: { channelId: existing.channel.id } })
    }
    await prisma.channelModerator.deleteMany({ where: { userId: existing.id } })
    await prisma.user.delete({ where: { id: existing.id } })
  }

  const free = await prisma.user.create({
    data: {
      email: FREE.email,
      passwordHash,
      username: FREE.username,
      displayName: FREE.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      isMember: false,
    },
  })

  const artist = await prisma.user.create({
    data: {
      email: ARTIST.email,
      passwordHash,
      username: ARTIST.username,
      displayName: ARTIST.displayName,
      emailVerifiedAt: new Date(),
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 90001,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      channel: {
        create: {
          slug: ARTIST.username,
          liveSourceMount: `/live/${ARTIST.username}`,
          liveSourcePass: 'demo-pass',
          liveSourcePassHash: await hashPassword('demo-pass'),
          rtmpStreamKey: `${ARTIST.username}__demo`,
          rtmpStreamKeyHash: await hashPassword(`${ARTIST.username}__demo`),
          state: 'OFFLINE',
        },
      },
    },
    include: { channel: true },
  })

  const moderator = await prisma.user.create({
    data: {
      email: MODERATOR.email,
      passwordHash,
      username: MODERATOR.username,
      displayName: MODERATOR.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      isMember: true,
      memberNumber: 90002,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
    },
  })

  // Delegated chat-moderation role (M27): the artist trusts this listener to ban/unban in their channel.
  await prisma.channelModerator.create({
    data: { channelId: artist.channel!.id, userId: moderator.id },
  })

  await prisma.user.create({
    data: {
      email: ADMIN.email,
      passwordHash,
      username: ADMIN.username,
      displayName: ADMIN.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      isMember: true,
      isBoard: true,
      memberNumber: 90003,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
    },
  })

  console.log(
    JSON.stringify(
      {
        password: PASS,
        accounts: {
          free: { email: FREE.email, username: FREE.username, role: 'Free listener' },
          artist: { email: ARTIST.email, username: ARTIST.username, role: 'Artist / member' },
          moderator: {
            email: MODERATOR.email,
            username: MODERATOR.username,
            role: `Moderator for @${ARTIST.username}`,
          },
          admin: { email: ADMIN.email, username: ADMIN.username, role: 'Board / admin' },
        },
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
