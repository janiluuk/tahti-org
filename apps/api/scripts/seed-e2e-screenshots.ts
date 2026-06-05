// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds deterministic users for visual e2e screenshots.
 * Run (stack): docker compose exec api tsx apps/api/scripts/seed-e2e-screenshots.ts
 * Run (host):  cd apps/api && DATABASE_URL=... pnpm dlx tsx scripts/seed-e2e-screenshots.ts
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../src/lib/token.js'

const PASS = 'screenshot-demo-pass'
const ARTIST = {
  email: 'screenshot-artist@e2e.tahti.live',
  username: 'screenshot-demo',
  displayName: 'Screenshot Demo Artist',
}
const MEMBER = {
  email: 'screenshot-fan@e2e.tahti.live',
  username: 'screenshot-fan',
  displayName: 'Screenshot Member',
}
const BOARD = {
  email: 'screenshot-board@e2e.tahti.live',
  username: 'screenshot-board',
  displayName: 'Screenshot Board',
}

const DEMO_MOTION_TITLE = 'E2E advisory motion'

async function main() {
  const passwordHash = await hashPassword(PASS)

  await prisma.motion.deleteMany({ where: { title: DEMO_MOTION_TITLE } })

  for (const email of [ARTIST.email, MEMBER.email, BOARD.email]) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (!existing) continue
    if (existing.channel) {
      await prisma.download.deleteMany({ where: { channelId: existing.channel.id } })
    }
    await prisma.release.deleteMany({ where: { userId: existing.id } })
    await prisma.fanTier.deleteMany({ where: { artistUserId: existing.id } })
    await prisma.fanSubscription.deleteMany({
      where: { OR: [{ artistUserId: existing.id }, { subscriberUserId: existing.id }] },
    })
    await prisma.user.delete({ where: { id: existing.id } })
  }

  const artist = await prisma.user.create({
    data: {
      email: ARTIST.email,
      passwordHash,
      username: ARTIST.username,
      displayName: ARTIST.displayName,
      emailVerifiedAt: new Date(),
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 99001,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      channel: {
        create: {
          slug: ARTIST.username,
          liveSourceMount: `/live/${ARTIST.username}`,
          liveSourcePass: 'screenshot-pass',
          liveSourcePassHash: await hashPassword('screenshot-pass'),
          rtmpStreamKey: `${ARTIST.username}__screenshot`,
          rtmpStreamKeyHash: await hashPassword(`${ARTIST.username}__screenshot`),
          state: 'OFFLINE',
        },
      },
    },
    include: { channel: true },
  })

  await prisma.fanTier.create({
    data: {
      artistUserId: artist.id,
      name: 'Supporter',
      amountCents: 500,
      description: 'Early access + 5× download weight',
      perks: ['Early mixes', 'Name in credits'],
      position: 0,
      active: true,
    },
  })

  const release = await prisma.release.create({
    data: {
      userId: artist.id,
      title: 'Northern Lights EP',
      type: 'EP',
      releaseDate: new Date('2026-03-15'),
      description: 'Demo release for e2e screenshots.',
      smartLinkSlug: 'northern-lights-ep',
      state: 'PUBLISHED',
      publishedAt: new Date(),
      tracks: {
        create: [
          { position: 1, title: 'Aurora', durationSec: 372 },
          { position: 2, title: 'Polar Drift', durationSec: 298 },
        ],
      },
    },
  })

  await prisma.archiveItem.create({
    data: {
      channelId: artist.channel!.id,
      title: 'Live at Klubi — March 2026',
      rawKey: 'raw/screenshot-demo.wav',
      mp3Key: 'mp3/screenshot-demo/live.mp3',
      flacKey: 'flac/screenshot-demo/live.flac',
      durationSec: 3600,
      fileSizeBytes: BigInt(50_000_000),
      status: 'READY',
    },
  })

  const member = await prisma.user.create({
    data: {
      email: MEMBER.email,
      passwordHash,
      username: MEMBER.username,
      displayName: MEMBER.displayName,
      emailVerifiedAt: new Date(),
      isMember: true,
      memberNumber: 99002,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
    },
  })

  await prisma.user.create({
    data: {
      email: BOARD.email,
      passwordHash,
      username: BOARD.username,
      displayName: BOARD.displayName,
      emailVerifiedAt: new Date(),
      isMember: true,
      isBoard: true,
      memberNumber: 99003,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
    },
  })

  const tier = await prisma.fanTier.findFirst({
    where: { artistUserId: artist.id },
    select: { name: true, amountCents: true },
  })
  if (tier) {
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: member.id,
        tierName: tier.name,
        amountCents: tier.amountCents,
        state: 'ACTIVE',
        stripeSubscriptionId: 'e2e_sub_screenshot',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  const now = new Date()
  await prisma.motion.create({
    data: {
      title: DEMO_MOTION_TITLE,
      description: 'Seeded open motion for journey e2e.',
      proposedBy: artist.id,
      advisory: true,
      state: 'OPEN',
      openAt: new Date(now.getTime() - 60_000),
      closeAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const verifyToken = generateVerificationToken()
  await prisma.emailVerification.create({
    data: {
      userId: member.id,
      token: verifyToken,
      expiresAt: verificationExpiresAt(),
    },
  })

  console.log(
    JSON.stringify(
      {
        password: PASS,
        artist: ARTIST.username,
        member: MEMBER.username,
        board: BOARD.username,
        fan: MEMBER.username,
        smartLinkSlug: release.smartLinkSlug,
        motionTitle: DEMO_MOTION_TITLE,
        verifyToken,
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
