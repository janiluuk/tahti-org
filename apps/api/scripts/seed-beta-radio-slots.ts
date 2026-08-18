// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Books 10 RadioSlotBooking rows for existing "[BETA]" placeholder artists,
 * spread across the rest of this week, so Tahti Radio's "Upcoming shows"
 * calendar looks like an active service for a community demo. Uses the
 * artists' own real channels (no new accounts) — same artists already
 * carrying profile/catalog content, so the calendar and the profiles tell
 * one consistent story.
 *
 * Idempotent: skips a (channelId, startAt) pair that already exists.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/seed-beta-radio-slots.ts
 */

import { prisma } from '@tahti/db'

interface SlotSpec {
  slug: string
  dayOffset: number // days from today (UTC)
  startHourUtc: number
  durationHours: number
  note: string
  showType: 'LIVE_SET' | 'TALK'
}

// All times UTC. Avoids the one existing future booking (yaniho, Wed 22:00-00:00).
const SLOTS: SlotSpec[] = [
  {
    slug: 'janis-berzins-lv',
    dayOffset: 1, // Wed
    startHourUtc: 15,
    durationHours: 1.5,
    note: 'Live set: Baltic electronic selections',
    showType: 'LIVE_SET',
  },
  {
    slug: 'anna-virtanen-fi',
    dayOffset: 1, // Wed
    startHourUtc: 17,
    durationHours: 0.75,
    note: 'Artist talk: inside the new EP',
    showType: 'TALK',
  },
  {
    slug: 'minh-nguyen-vn',
    dayOffset: 2, // Thu
    startHourUtc: 15,
    durationHours: 1,
    note: 'Live DJ set',
    showType: 'LIVE_SET',
  },
  {
    slug: 'kadri-tamm-ee',
    dayOffset: 2, // Thu
    startHourUtc: 18,
    durationHours: 1.5,
    note: 'EP premiere listening party',
    showType: 'LIVE_SET',
  },
  {
    slug: 'karlis-ozols-lv',
    dayOffset: 3, // Fri
    startHourUtc: 16,
    durationHours: 1,
    note: 'Acoustic session',
    showType: 'LIVE_SET',
  },
  {
    slug: 'huy-pham-vn',
    dayOffset: 3, // Fri
    startHourUtc: 19,
    durationHours: 1.5,
    note: 'Live set',
    showType: 'LIVE_SET',
  },
  {
    slug: 'elina-makinen-fi',
    dayOffset: 4, // Sat
    startHourUtc: 14,
    durationHours: 1,
    note: 'Artist talk: behind Slow Static',
    showType: 'TALK',
  },
  {
    slug: 'liga-kalnins-lv',
    dayOffset: 4, // Sat
    startHourUtc: 17,
    durationHours: 2,
    note: 'Album release live set',
    showType: 'LIVE_SET',
  },
  {
    slug: 'mart-saar-ee',
    dayOffset: 5, // Sun
    startHourUtc: 15,
    durationHours: 1,
    note: 'Sunday acoustic session',
    showType: 'LIVE_SET',
  },
  {
    slug: 'linh-tran-vn',
    dayOffset: 5, // Sun
    startHourUtc: 18,
    durationHours: 1.5,
    note: 'Live DJ set: closing the week',
    showType: 'LIVE_SET',
  },
]

function atUtc(dayOffset: number, hourUtc: number): Date {
  const now = new Date()
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(base + dayOffset * 86_400_000 + hourUtc * 3_600_000)
}

async function main() {
  const results: Array<{ slug: string; startAt: Date; endAt: Date; created: boolean }> = []

  for (const slot of SLOTS) {
    const channel = await prisma.channel.findUnique({
      where: { slug: slot.slug },
      select: { id: true },
    })
    if (!channel) {
      console.warn(`[seed-beta-radio-slots] channel not found: ${slot.slug}`)
      continue
    }

    const startAt = atUtc(slot.dayOffset, slot.startHourUtc)
    const endAt = new Date(startAt.getTime() + slot.durationHours * 3_600_000)

    const existing = await prisma.radioSlotBooking.findFirst({
      where: { channelId: channel.id, startAt },
      select: { id: true },
    })
    if (existing) {
      results.push({ slug: slot.slug, startAt, endAt, created: false })
      continue
    }

    await prisma.radioSlotBooking.create({
      data: {
        channelId: channel.id,
        startAt,
        endAt,
        note: slot.note,
        showType: slot.showType,
      },
    })
    results.push({ slug: slot.slug, startAt, endAt, created: true })
  }

  console.log(JSON.stringify({ ok: true, booked: results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
