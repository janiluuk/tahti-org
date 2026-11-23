// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Fills Discover → Events and Listening parties with a small set of demo
 * rows so production (and local stacks after --seed) are not empty. Uses
 * Prisma directly so follower notifications are not fired.
 *
 * Idempotent: skips an event with the same (userId, title, startAt), and a
 * party with the same (channelId, releaseId, startAt).
 *
 * Run (prod): ssh vimage, then:
 *   docker compose -f infra/docker-compose.stack.yml exec api \
 *     tsx apps/api/scripts/seed-demo-events-and-parties.ts
 */

import { prisma } from '@tahti/db'

const PRESET = (n: number) =>
  `https://tahti.live/artwork-presets/artwork-${String(n).padStart(2, '0')}.webp`

type EventSpec = {
  username: string
  title: string
  description: string
  place: string
  location: string
  dayOffset: number
  startHourUtc: number
  durationHours?: number
  timezone?: string
  eventUrl?: string
  ticketUrl?: string
  imagePreset: number
  visibility?: 'PUBLIC' | 'FANS'
}

type PartySpec = {
  username: string
  /** Prefer this release title when the artist has several published ones. */
  releaseTitle?: string
  dayOffset: number
  startHourUtc: number
  hostNote: string
}

const EVENTS: EventSpec[] = [
  {
    username: 'yaniho',
    title: 'Euphorizer LP — album night',
    description:
      'Full-album listening and a short live encore from the Euphorizer sessions. Doors 18:30; set around 19:30. Cassette leftovers at the merch table.',
    place: 'Ääniwalli',
    location: 'Helsinki, Finland',
    dayOffset: 5,
    startHourUtc: 16,
    durationHours: 4,
    timezone: 'Europe/Helsinki',
    imagePreset: 8,
  },
  {
    username: 'yaniho',
    title: 'Late studio open — progressive & techno',
    description:
      'In-person edition of the Thursday broadcast: two hours recorded live, Q&A between sets, silent-disco closer. BYO headphones.',
    place: 'Kuudes Linja',
    location: 'Helsinki, Finland',
    dayOffset: 12,
    startHourUtc: 19,
    durationHours: 5,
    timezone: 'Europe/Helsinki',
    eventUrl: 'https://kuudeslinja.fi/',
    imagePreset: 3,
  },
  {
    username: 'yaniho',
    title: 'Forest Cover — outdoor listening',
    description:
      'Acoustic set recorded and played back the same evening near the trail. Bring a blanket; weather-dependent. Free, donations welcome.',
    place: 'Nuuksio — Haukkalampi',
    location: 'Espoo, Finland',
    dayOffset: 19,
    startHourUtc: 14,
    durationHours: 3,
    timezone: 'Europe/Helsinki',
    imagePreset: 12,
    visibility: 'FANS',
  },
  {
    username: 'anna-virtanen-fi',
    title: 'Pale Circuit — EP release show',
    description:
      'Live debut of Pale Circuit start to finish, plus two unreleased sketches. All ages until 22:00.',
    place: 'Tavastia Club — Small Stage',
    location: 'Helsinki, Finland',
    dayOffset: 3,
    startHourUtc: 17,
    durationHours: 3,
    timezone: 'Europe/Helsinki',
    imagePreset: 5,
  },
  {
    username: 'janis-berzins-lv',
    title: 'Loose Thread — Riga listening night',
    description:
      'Album played through on a proper PA, short talk on the Baltic sessions, then a DJ hour from the supporting cast.',
    place: 'Depo',
    location: 'Riga, Latvia',
    dayOffset: 8,
    startHourUtc: 17,
    durationHours: 3,
    timezone: 'Europe/Riga',
    imagePreset: 7,
  },
  {
    username: 'kadri-tamm-ee',
    title: 'Faint Echo — Tallinn premiere',
    description:
      'First full performance of Faint Echo with visuals. Limited capacity; advance tickets recommended.',
    place: 'Von Krahl',
    location: 'Tallinn, Estonia',
    dayOffset: 10,
    startHourUtc: 18,
    durationHours: 2.5,
    timezone: 'Europe/Tallinn',
    ticketUrl: 'https://tahti.live/',
    imagePreset: 10,
  },
  {
    username: 'minh-nguyen-vn',
    title: 'Hollow Bell — warehouse session',
    description:
      'Four-hour progressive set built around Hollow Bell stems. No phones on the dancefloor until midnight.',
    place: 'The Warehouse Project — Room 2',
    location: 'Ho Chi Minh City, Vietnam',
    dayOffset: 14,
    startHourUtc: 12,
    durationHours: 4,
    imagePreset: 15,
  },
  {
    username: 'elina-makinen-fi',
    title: 'Shortwave — Sunday matinee',
    description:
      'Daytime listening of Shortwave with coffee and a Q&A on field recordings. Kids welcome.',
    place: 'Cultural Centre Caisa',
    location: 'Helsinki, Finland',
    dayOffset: 6,
    startHourUtc: 11,
    durationHours: 2,
    timezone: 'Europe/Helsinki',
    imagePreset: 2,
  },
]

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

async function seedEvents() {
  const results: Array<{ username: string; title: string; created: boolean }> = []
  for (const spec of EVENTS) {
    const user = await prisma.user.findUnique({
      where: { username: spec.username },
      select: { id: true },
    })
    if (!user) {
      console.warn(`[seed-demo-events] user not found: ${spec.username}`)
      continue
    }
    const startAt = atUtc(spec.dayOffset, spec.startHourUtc)
    const endAt =
      spec.durationHours != null
        ? new Date(startAt.getTime() + spec.durationHours * 3_600_000)
        : null
    const existing = await prisma.artistEvent.findFirst({
      where: { userId: user.id, title: spec.title, startAt },
      select: { id: true },
    })
    if (existing) {
      results.push({ username: spec.username, title: spec.title, created: false })
      continue
    }
    await prisma.artistEvent.create({
      data: {
        userId: user.id,
        title: spec.title,
        description: spec.description,
        place: spec.place,
        location: spec.location,
        eventUrl: spec.eventUrl ?? null,
        ticketUrl: spec.ticketUrl ?? null,
        imageUrl: PRESET(spec.imagePreset),
        gallery: [],
        startAt,
        endAt,
        timezone: spec.timezone ?? null,
        visibility: spec.visibility ?? 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    results.push({ username: spec.username, title: spec.title, created: true })
  }
  return results
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
  const events = await seedEvents()
  const parties = await seedParties()
  console.log(
    JSON.stringify(
      {
        ok: true,
        eventsCreated: events.filter((r) => r.created).length,
        eventsSkipped: events.filter((r) => !r.created).length,
        partiesCreated: parties.filter((r) => r.created).length,
        partiesSkipped: parties.filter((r) => !r.created).length,
        events,
        parties,
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
