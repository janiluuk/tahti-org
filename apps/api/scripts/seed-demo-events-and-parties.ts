// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Fills Discover → Listening parties with a small set of demo rows so
 * production (and local stacks after --seed) are not empty. Uses Prisma
 * directly so follower notifications are not fired.
 *
 * Events come from City of Helsinki Linked Events instead — see
 * seed-helsinki-linked-events.ts (replaces the earlier hand-written mocks).
 *
 * Idempotent: skips a party with the same (channelId, releaseId, startAt).
 *
 * Run (prod): ssh vimage, then:
 *   docker compose -f infra/docker-compose.stack.yml exec api \
 *     tsx apps/api/scripts/seed-demo-events-and-parties.ts
 */

import { prisma } from '@tahti/db'

type PartySpec = {
  username: string
  /** Prefer this release title when the artist has several published ones. */
  releaseTitle?: string
  dayOffset: number
  startHourUtc: number
  hostNote: string
}

const PARTIES: PartySpec[] = [
  {
    username: 'anna-virtanen-fi',
    releaseTitle: 'Pale Circuit',
    dayOffset: 2,
    startHourUtc: 18,
    hostNote:
      'Press play with me — Pale Circuit, start to finish. Chat stays open for track notes.',
  },
  {
    username: 'janis-berzins-lv',
    releaseTitle: 'Loose Thread',
    dayOffset: 4,
    startHourUtc: 19,
    hostNote: 'Premiere listen of Loose Thread. Drop a reaction when the third track hits.',
  },
  {
    username: 'kadri-tamm-ee',
    releaseTitle: 'Faint Echo',
    dayOffset: 7,
    startHourUtc: 17,
    hostNote: 'Quiet headphones party for Faint Echo. I’ll call out stems as we go.',
  },
  {
    username: 'minh-nguyen-vn',
    releaseTitle: 'Hollow Bell',
    dayOffset: 9,
    startHourUtc: 13,
    hostNote: 'Hollow Bell listening party — full album sync, then open chat for remix ideas.',
  },
  {
    username: 'elina-makinen-fi',
    releaseTitle: 'Shortwave',
    dayOffset: 11,
    startHourUtc: 16,
    hostNote: 'Sunday Shortwave sync. Soft start; no spoilers in chat until the closer.',
  },
  {
    username: 'mikael-korhonen-fi',
    releaseTitle: 'Analog Drift',
    dayOffset: 13,
    startHourUtc: 18,
    hostNote: 'Analog Drift end-to-end. I’ll leave a host note on each track as it starts.',
  },
]

function atUtc(dayOffset: number, hourUtc: number): Date {
  const now = new Date()
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(base + dayOffset * 86_400_000 + hourUtc * 3_600_000)
}

async function seedParties() {
  const results: Array<{ username: string; release: string; created: boolean; skipped?: string }> =
    []
  for (const spec of PARTIES) {
    const user = await prisma.user.findUnique({
      where: { username: spec.username },
      select: { id: true },
    })
    if (!user) {
      results.push({
        username: spec.username,
        release: spec.releaseTitle ?? '',
        created: false,
        skipped: 'user missing',
      })
      continue
    }
    const channel = await prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) {
      results.push({
        username: spec.username,
        release: spec.releaseTitle ?? '',
        created: false,
        skipped: 'no channel',
      })
      continue
    }
    const release = await prisma.release.findFirst({
      where: {
        userId: user.id,
        state: 'PUBLISHED',
        ...(spec.releaseTitle ? { title: spec.releaseTitle } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        tracks: { select: { durationSec: true, streamKey: true } },
      },
    })
    if (!release) {
      results.push({
        username: spec.username,
        release: spec.releaseTitle ?? '',
        created: false,
        skipped: 'no published release',
      })
      continue
    }
    if (
      release.tracks.length === 0 ||
      release.tracks.some((t) => !t.durationSec || t.durationSec <= 0 || !t.streamKey)
    ) {
      results.push({
        username: spec.username,
        release: release.title,
        created: false,
        skipped: 'tracks not stream-ready',
      })
      continue
    }
    const startAt = atUtc(spec.dayOffset, spec.startHourUtc)
    const existing = await prisma.listeningParty.findFirst({
      where: { channelId: channel.id, releaseId: release.id, startAt },
      select: { id: true },
    })
    if (existing) {
      results.push({ username: spec.username, release: release.title, created: false })
      continue
    }
    await prisma.listeningParty.create({
      data: {
        releaseId: release.id,
        channelId: channel.id,
        hostUserId: user.id,
        startAt,
        hostNote: spec.hostNote,
      },
    })
    results.push({ username: spec.username, release: release.title, created: true })
  }
  return results
}

async function main() {
  const parties = await seedParties()
  console.log(
    JSON.stringify(
      {
        ok: true,
        partiesCreated: parties.filter((r) => r.created).length,
        partiesSkipped: parties.filter((r) => !r.created).length,
        parties,
        note: 'Events: run seed-helsinki-linked-events.ts',
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
