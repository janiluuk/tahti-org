// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds deterministic users for visual e2e screenshots.
 * Run (stack): docker compose exec api tsx apps/api/scripts/seed-e2e-screenshots.ts
 * Run (host):  cd apps/api && DATABASE_URL=... pnpm dlx tsx scripts/seed-e2e-screenshots.ts
 */

import { prisma } from '@tahti/db'
import { editListFromV0Trim } from '@tahti/audio-edit'
import { hashPassword } from '../src/lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../src/lib/token.js'
import { s3 } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { PutObjectCommand } from '@aws-sdk/client-s3'

/** Small mono 16-bit PCM WAV buffer (silence) — enough for the audio editor and
 * channel player to actually have bytes to stream; format fidelity doesn't matter
 * for a seed fixture, only that the object exists. */
function makeSilentWav(durationSec = 5, sampleRate = 8000): Buffer {
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

// Best-effort: some seed contexts (lighter CI jobs that only need the DB rows,
// not playable audio) don't run a MinIO container at all. Don't fail the whole
// seed over a missing object store there.
async function uploadFixtureAudio(key: string, contentType: string): Promise<void> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
        Body: makeSilentWav(),
        ContentType: contentType,
      }),
    )
  } catch (err) {
    console.warn(`fixture audio upload skipped for ${key}: ${String(err)}`)
  }
}

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
const FREE = {
  email: 'screenshot-free@e2e.tahti.live',
  username: 'screenshot-free',
  displayName: 'Screenshot Free Listener',
}
const FRESH = {
  email: 'screenshot-fresh@e2e.tahti.live',
  username: 'screenshot-fresh',
  displayName: 'Fresh Journey Artist',
}
const LIVE_ARTIST = {
  email: 'screenshot-live@e2e.tahti.live',
  username: 'screenshot-live-demo',
  displayName: 'Screenshot Live Artist',
}
const COLLECTION_SLUG = 'demo-mixes'

/** Fixed future time so channel countdown screenshots stay stable between runs. */
const NEXT_BROADCAST_AT = new Date('2026-07-10T20:00:00.000Z')
const NEXT_BROADCAST_NOTE = 'Weekly live — Thursdays 20:00 UTC'

const DEMO_MOTION_TITLE = 'E2E advisory motion'

async function main() {
  const passwordHash = await hashPassword(PASS)

  await prisma.motion.deleteMany({ where: { title: DEMO_MOTION_TITLE } })
  await prisma.venue.deleteMany({ where: { slug: { in: ['klubi-tampere', 'kuudes-linja'] } } })
  await prisma.boardResolution.deleteMany({
    where: { title: 'Approve FY2026 grant disbursement pool' },
  })
  await prisma.supportTicket.deleteMany({
    where: {
      contactEmail: {
        in: [
          'screenshot-artist@e2e.tahti.live',
          'screenshot-fan@e2e.tahti.live',
          'listener@example.com',
        ],
      },
    },
  })
  await prisma.betaApplication.deleteMany({
    where: {
      email: { in: ['aino.korhonen@example.com', 'joel.makinen@example.com', 'spam@example.com'] },
    },
  })
  await prisma.ledgerEntry.deleteMany({
    where: {
      description: {
        in: [
          'Member subscriptions (Stripe payout)',
          'One-off donations',
          'Hetzner + Icecast relay hosting',
          'Accounting services',
        ],
      },
    },
  })
  await prisma.auditLog.deleteMany({
    where: {
      action: {
        in: [
          'MOTION_OPEN',
          'BOARD_ROLE_CHANGE',
          'GRANT_RUN',
          'ARCHIVE_EDIT_PUBLISH',
          'RTMP_TARGET_ADD',
        ],
      },
    },
  })

  for (const email of [
    ARTIST.email,
    MEMBER.email,
    BOARD.email,
    FREE.email,
    FRESH.email,
    LIVE_ARTIST.email,
  ]) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (!existing) continue
    if (existing.channel) {
      await prisma.download.deleteMany({ where: { channelId: existing.channel.id } })
    }
    await prisma.stashShare.deleteMany({ where: { file: { userId: existing.id } } })
    await prisma.stashFile.deleteMany({ where: { userId: existing.id } })
    await prisma.editorProject.deleteMany({ where: { userId: existing.id } })
    await prisma.collection.deleteMany({ where: { userId: existing.id } })
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
      bio: 'Deep house & ambient from Helsinki. Member-owned broadcasting on Tahti.',
      countryCode: 'FI',
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
          fallbackMode: 'ordered',
          nextBroadcastAt: NEXT_BROADCAST_AT,
          nextBroadcastNote: NEXT_BROADCAST_NOTE,
          visualPreset: 'AURORA',
          textLayerMode: 'GRADIENT_SHIMMER',
          textLayerText: 'Archive rotation · Live Thursdays 20:00 UTC',
          colorSchemeJson: JSON.stringify({
            bg: '#0a1628',
            accent: '#00d4aa',
            text: '#e8f4f0',
            muted: '#4a6670',
            highlight: '#66e3c4',
          }),
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
      visualPreset: 'PARTICLE_FIELD',
      colorSchemeJson: JSON.stringify({
        bg: '#1a0a28',
        accent: '#a855f7',
        text: '#f3e8ff',
        muted: '#6b5080',
        highlight: '#c084fc',
      }),
      tracks: {
        create: [
          { position: 1, title: 'Aurora', durationSec: 372 },
          { position: 2, title: 'Polar Drift', durationSec: 298 },
        ],
      },
    },
  })

  const catalogAlbum = await prisma.release.create({
    data: {
      userId: artist.id,
      title: 'Deep Catalog Album',
      type: 'ALBUM',
      releaseDate: new Date('2026-05-01'),
      description: 'Five-track draft album for e2e catalog journey.',
      smartLinkSlug: 'deep-catalog-album',
      state: 'DRAFT',
      visualPreset: 'AURORA',
      colorSchemeJson: JSON.stringify({
        bg: '#0a1628',
        accent: '#00d4aa',
        text: '#e8f4f0',
        muted: '#4a6670',
        highlight: '#66e3c4',
      }),
      tracks: {
        create: [
          { position: 1, title: 'Deep One', durationSec: 240 },
          { position: 2, title: 'Deep Two', durationSec: 260 },
          { position: 3, title: 'Deep Three', durationSec: 220 },
          { position: 4, title: 'Deep Four', durationSec: 300 },
          { position: 5, title: 'Deep Five', durationSec: 280 },
        ],
      },
    },
  })

  const catalogSingle = await prisma.release.create({
    data: {
      userId: artist.id,
      title: 'Midnight Single',
      type: 'SINGLE',
      releaseDate: new Date('2026-04-20'),
      smartLinkSlug: 'midnight-single',
      state: 'PUBLISHED',
      publishedAt: new Date(),
      visualPreset: 'REACTIVE_GRID',
      colorSchemeJson: JSON.stringify({
        bg: '#1c1408',
        accent: '#f59e0b',
        text: '#fef3c7',
        muted: '#78716c',
        highlight: '#fbbf24',
      }),
      tracks: {
        create: [{ position: 1, title: 'Midnight Run', durationSec: 210 }],
      },
    },
  })

  await prisma.collection.create({
    data: {
      userId: artist.id,
      slug: `${ARTIST.username}-album-stash`,
      name: 'Album stash vault',
      type: 'ALBUM',
      isPublic: false,
      description: 'Private collection holding the draft album (e2e fans-only stash).',
      items: {
        create: [{ releaseId: catalogAlbum.id, position: 1 }],
      },
    },
  })

  await prisma.stashFile.create({
    data: {
      userId: artist.id,
      filename: 'deep-catalog-masters.zip',
      objectKey: `stash/${artist.id}/deep-catalog-masters.zip`,
      contentType: 'application/zip',
      sizeBytes: BigInt(15_000_000),
      format: 'ZIP',
      shares: {
        create: {
          granteeUsername: MEMBER.username,
          permission: 'READ',
        },
      },
    },
  })

  const archiveItem = await prisma.archiveItem.create({
    data: {
      channelId: artist.channel!.id,
      title: 'Live at Klubi — March 2026',
      description: 'Recorded live at Klubi, Helsinki — deep house and ambient.',
      genre: 'Deep House',
      commentary: 'Thank you to everyone who came through on the night.',
      rawKey: 'raw/screenshot-demo.wav',
      mp3Key: 'mp3/screenshot-demo/live.mp3',
      flacKey: 'flac/screenshot-demo/live.flac',
      durationSec: 3600,
      fileSizeBytes: BigInt(50_000_000),
      status: 'READY',
      isPublic: true,
      isFallback: true,
      fallbackOrder: 0,
      editList: editListFromV0Trim({
        sourceDuration: 3600,
        startSec: 120,
        endSec: 3480,
        fadeInSec: 2,
        fadeOutSec: 3,
        peakNormalize: false,
        lufsTarget: 'stream',
        limiterEnabled: true,
        highPassHz: 80,
        lowPassHz: 0,
        eq: { lowGainDb: 0, midGainDb: 0, highGainDb: 0 },
        compressorEnabled: false,
      }),
    },
  })

  await Promise.all([
    uploadFixtureAudio(archiveItem.rawKey!, 'audio/wav'),
    uploadFixtureAudio(archiveItem.mp3Key!, 'audio/mpeg'),
    uploadFixtureAudio(archiveItem.flacKey!, 'audio/flac'),
  ])

  const editorProject = await prisma.editorProject.create({
    data: {
      userId: artist.id,
      title: 'Live at Klubi — edit',
      archiveItemId: archiveItem.id,
      timeline: {
        tracks: [],
        seedArchiveItemId: archiveItem.id,
      },
    },
  })

  await prisma.collection.create({
    data: {
      userId: artist.id,
      slug: COLLECTION_SLUG,
      name: 'Demo Mixes',
      type: 'MIX_SERIES',
      isPublic: true,
      isFeatured: true,
      description: 'Seeded mix series for e2e screenshots.',
      items: {
        create: [{ archiveItemId: archiveItem.id, position: 1 }],
      },
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
      email: FREE.email,
      passwordHash,
      username: FREE.username,
      displayName: FREE.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      isMember: false,
    },
  })

  await prisma.user.create({
    data: {
      email: FRESH.email,
      passwordHash,
      username: FRESH.username,
      displayName: FRESH.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      isMember: false,
    },
  })

  const board = await prisma.user.create({
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

  const liveArtist = await prisma.user.create({
    data: {
      email: LIVE_ARTIST.email,
      passwordHash,
      username: LIVE_ARTIST.username,
      displayName: LIVE_ARTIST.displayName,
      bio: 'Live looping & techno, broadcasting from Tampere.',
      countryCode: 'FI',
      emailVerifiedAt: new Date(),
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 99004,
      memberSince: new Date(),
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      channel: {
        create: {
          slug: LIVE_ARTIST.username,
          liveSourceMount: `/live/${LIVE_ARTIST.username}`,
          liveSourcePass: 'screenshot-pass',
          liveSourcePassHash: await hashPassword('screenshot-pass'),
          rtmpStreamKey: `${LIVE_ARTIST.username}__screenshot`,
          rtmpStreamKeyHash: await hashPassword(`${LIVE_ARTIST.username}__screenshot`),
          state: 'LIVE',
          goneLiveAt: new Date(),
          fallbackMode: 'ordered',
          visualPreset: 'MINIMAL',
        },
      },
    },
    include: { channel: true },
  })

  const tier = await prisma.fanTier.findFirst({
    where: { artistUserId: artist.id },
    select: { name: true, amountCents: true },
  })
  let fanSub: { id: string } | null = null
  if (tier) {
    fanSub = await prisma.fanSubscription.create({
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

  await prisma.fanTier.create({
    data: {
      artistUserId: artist.id,
      name: 'Patron',
      amountCents: 1500,
      description: 'Supporter perks + monthly stash drop',
      perks: ['Early mixes', 'Name in credits', 'Monthly stash drop'],
      position: 1,
      active: true,
    },
  })
  const patronSub = await prisma.fanSubscription.create({
    data: {
      artistUserId: artist.id,
      subscriberUserId: board.id,
      tierName: 'Patron',
      amountCents: 1500,
      state: 'ACTIVE',
      stripeSubscriptionId: 'e2e_sub_screenshot_patron',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  if (fanSub) {
    await prisma.fanSubPayout.createMany({
      data: [
        {
          fanSubscriptionId: fanSub.id,
          artistUserId: artist.id,
          forPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          forPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 0),
          grossCents: 500,
          stripeFeeCents: 25,
          orgFeeCents: 25,
          netToArtistCents: 450,
          stripeTransferId: 'tr_screenshot_paid',
          state: 'PAID',
          paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 5),
        },
        {
          fanSubscriptionId: fanSub.id,
          artistUserId: artist.id,
          forPeriodStart: periodStart,
          forPeriodEnd: periodEnd,
          grossCents: 500,
          stripeFeeCents: 25,
          orgFeeCents: 25,
          netToArtistCents: 450,
          // PAID (not PENDING) so the dashboard's "Revenue this month" stat — which
          // only aggregates state:'PAID' payouts paidAt this month — isn't zero on
          // the /for-artists marketing screenshot captured from this account.
          stripeTransferId: 'tr_screenshot_paid_current',
          state: 'PAID',
          paidAt: now,
        },
      ],
    })
  }
  await prisma.fanSubPayout.create({
    data: {
      fanSubscriptionId: patronSub.id,
      artistUserId: artist.id,
      forPeriodStart: periodStart,
      forPeriodEnd: periodEnd,
      grossCents: 1500,
      stripeFeeCents: 70,
      orgFeeCents: 75,
      netToArtistCents: 1355,
      state: 'FAILED',
    },
  })

  await prisma.betaApplication.createMany({
    data: [
      {
        name: 'Aino Korhonen',
        email: 'aino.korhonen@example.com',
        artistType: 'DJ / electronic producer',
        links: 'https://soundcloud.com/ainokorhonen',
        message: 'Weekly ambient/techno show, currently self-hosting a Liquidsoap stream.',
        source: 'twitter',
        status: 'PENDING',
      },
      {
        name: 'Joel Mäkinen',
        email: 'joel.makinen@example.com',
        artistType: 'Live band',
        links: 'https://joelmakinen.bandcamp.com',
        message: 'Touring band looking for an archive and smart links home.',
        source: 'referral',
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: board.id,
      },
      {
        name: 'Spam Bot 9000',
        email: 'spam@example.com',
        artistType: 'Unknown',
        message: 'buy followers fast',
        source: 'form',
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: board.id,
      },
    ],
  })

  const supportTicket = await prisma.supportTicket.create({
    data: {
      artistId: artist.id,
      contactEmail: ARTIST.email,
      subject: 'RTMP key rotated but OBS still rejects',
      message:
        'Rotated the stream key after the security email but OBS reports a 403 connecting to Icecast.',
      category: 'TECHNICAL',
      status: 'OPEN',
    },
  })
  await prisma.supportTicketNote.create({
    data: {
      ticketId: supportTicket.id,
      body: 'Asked for OBS log output; likely a stale key cached client-side.',
      authorId: board.id,
    },
  })
  await prisma.supportTicket.create({
    data: {
      artistId: member.id,
      contactEmail: MEMBER.email,
      subject: 'Fan subscription receipt missing VAT breakdown',
      message:
        'Need a VAT-itemized receipt for the Supporter tier subscription for accounting purposes.',
      category: 'FINANCIAL',
      status: 'IN_PROGRESS',
      assignedToId: board.id,
    },
  })
  await prisma.supportTicket.create({
    data: {
      contactEmail: 'listener@example.com',
      subject: 'Engagement units look low for my downloads',
      message: 'Downloaded 4 tracks last week as a fan-subscriber but units only show 1x weight.',
      category: 'ENGAGEMENT_DISPUTE',
      status: 'RESOLVED',
      assignedToId: board.id,
    },
  })

  await prisma.boardResolution.create({
    data: {
      title: 'Approve FY2026 grant disbursement pool',
      body: '## Resolution\n\nThe board approves allocating the engagement-unit-weighted grant pool for FY2026 per the financial model.',
      votedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      outcome: 'PASSED',
      voteFor: 3,
      voteAgainst: 0,
      voteAbstain: 0,
      createdById: board.id,
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  })

  const venue = await prisma.venue.create({
    data: {
      slug: 'klubi-tampere',
      name: 'Klubi',
      address: 'Tullikamarinaukio 2',
      city: 'Tampere',
      countryCode: 'FI',
      capacity: 600,
      description: 'Independent live music venue hosting member-broadcast nights.',
      verifiedAt: new Date(),
      createdBy: artist.id,
    },
  })
  await prisma.venueBroadcast.create({
    data: {
      venueId: venue.id,
      artistUserId: artist.id,
      startAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      description: 'Live broadcast of the Northern Lights EP release show.',
      state: 'SCHEDULED',
    },
  })
  await prisma.venue.create({
    data: {
      slug: 'kuudes-linja',
      name: 'Kuudes Linja',
      address: 'Hämeentie 13',
      city: 'Helsinki',
      countryCode: 'FI',
      description: 'New submission awaiting verification.',
      createdBy: liveArtist.id,
    },
  })

  await prisma.ledgerEntry.createMany({
    data: [
      {
        category: 'REVENUE_SUBSCRIPTION',
        amountCents: 50000n,
        description: 'Member subscriptions (Stripe payout)',
        periodStart,
        periodEnd,
        createdBy: board.id,
      },
      {
        category: 'REVENUE_DONATION',
        amountCents: 12000n,
        description: 'One-off donations',
        periodStart,
        periodEnd,
        createdBy: board.id,
      },
      {
        category: 'COST_INFRASTRUCTURE',
        amountCents: 18000n,
        description: 'Hetzner + Icecast relay hosting',
        periodStart,
        periodEnd,
        createdBy: board.id,
      },
      {
        category: 'COST_PROFESSIONAL_SERVICES',
        amountCents: 9000n,
        description: 'Accounting services',
        periodStart,
        periodEnd,
        createdBy: board.id,
      },
    ],
  })

  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await prisma.monthlyRollup.upsert({
    where: { yearMonth },
    create: {
      yearMonth,
      byCategory: {
        REVENUE_SUBSCRIPTION: 50000,
        REVENUE_DONATION: 12000,
        COST_INFRASTRUCTURE: 18000,
        COST_PROFESSIONAL_SERVICES: 9000,
      },
      surplus: 35000n,
    },
    update: {
      byCategory: {
        REVENUE_SUBSCRIPTION: 50000,
        REVENUE_DONATION: 12000,
        COST_INFRASTRUCTURE: 18000,
        COST_PROFESSIONAL_SERVICES: 9000,
      },
      surplus: 35000n,
    },
  })

  const motion = await prisma.motion.create({
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

  await prisma.auditLog.createMany({
    data: [
      {
        action: 'MOTION_OPEN',
        actorId: artist.id,
        targetId: motion.id,
        meta: { title: DEMO_MOTION_TITLE },
      },
      {
        action: 'BOARD_ROLE_CHANGE',
        actorId: board.id,
        targetId: board.id,
        meta: { isBoard: true },
      },
      {
        action: 'GRANT_RUN',
        actorId: board.id,
        targetId: String(now.getFullYear() - 1),
        meta: { grantCount: 1, poolCents: 35000 },
      },
      {
        action: 'ARCHIVE_EDIT_PUBLISH',
        actorId: artist.id,
        targetId: archiveItem.id,
        meta: { title: archiveItem.title },
      },
      {
        action: 'RTMP_TARGET_ADD',
        actorId: artist.id,
        targetId: artist.channel!.id,
        meta: { platform: 'youtube' },
      },
    ],
  })

  const countries = ['FI', 'SE', 'DE', 'NO']
  await prisma.download.createMany({
    data: Array.from({ length: 24 }, (_, i) => {
      const daysAgo = Math.floor((i / 24) * 28)
      const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
      return {
        channelId: artist.channel!.id,
        archiveItemId: archiveItem.id,
        format: ['mp3_320', 'flac', 'opus256'][i % 3],
        byFingerprint: `screenshot-fp-${i}`,
        byIpHash: `screenshot-ip-${i}`,
        countryCode: countries[i % countries.length],
        bytes: 4_000_000 + i * 10_000,
        countedAt: createdAt,
        weight: i % 5 === 0 ? 5 : 1,
        createdAt,
      }
    }),
  })

  // Non-zero "Plays this month" / broadcast count on the dashboard, which is
  // otherwise zero on this account and shows up as-is on the /for-artists
  // marketing screenshot.
  await prisma.broadcast.create({
    data: {
      channelId: artist.channel!.id,
      source: 'ICECAST',
      startedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      endedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      archiveItemId: archiveItem.id,
    },
  })

  // Non-zero "Fan subscribers" (confirmed newsletter subscriber count) for the
  // same screenshot.
  await prisma.newsletterSubscriber.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({
      artistUserId: artist.id,
      email: `e2e-newsletter-${i}@e2e.tahti.live`,
      confirmedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      unsubToken: `e2e-unsub-${i}`,
    })),
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
        artistEmail: ARTIST.email,
        member: MEMBER.username,
        memberEmail: MEMBER.email,
        free: FREE.username,
        freeEmail: FREE.email,
        fresh: FRESH.username,
        freshEmail: FRESH.email,
        board: BOARD.username,
        boardEmail: BOARD.email,
        fan: MEMBER.username,
        smartLinkSlug: release.smartLinkSlug,
        releaseId: release.id,
        catalogAlbumSlug: catalogAlbum.smartLinkSlug,
        catalogSingleSlug: catalogSingle.smartLinkSlug,
        albumStashCollection: `${ARTIST.username}-album-stash`,
        collectionSlug: COLLECTION_SLUG,
        archiveItemId: archiveItem.id,
        editorProjectId: editorProject.id,
        nextBroadcastAt: NEXT_BROADCAST_AT.toISOString(),
        nextBroadcastNote: NEXT_BROADCAST_NOTE,
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
