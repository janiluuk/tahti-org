// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Books a handful of upcoming RadioSlotBooking rows on Tahti Radio so the
 * "Upcoming shows" section has real data to show. Uses dedicated placeholder
 * DJ artist accounts (created if missing) rather than real members' channels,
 * since this schedules public "live now" slots and we don't want to put a
 * real artist on the air without them actually booking it themselves.
 *
 * Idempotent: clears and re-creates only the bookings for these placeholder
 * DJ channels each run, so it's safe to re-run after adjusting times.
 *
 * Run (stack):  docker compose run --rm api tsx apps/api/scripts/seed-radio-dj-slots.ts
 * Run (prod):   ssh vimage, then inside the api container, same command.
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

interface DjSpec {
  email: string
  username: string
  displayName: string
  note: string
  /** Hours from now the slot starts, and how long it runs. */
  startInHours: number
  durationHours: number
}

const DJS: DjSpec[] = [
  {
    email: 'dj-aurora@tahti.live',
    username: 'dj-aurora',
    displayName: 'DJ Aurora',
    note: 'Ambient & downtempo set',
    startInHours: 4,
    durationHours: 2,
  },
  {
    email: 'dj-nocturne@tahti.live',
    username: 'dj-nocturne',
    displayName: 'DJ Nocturne',
    note: 'Late-night techno',
    startInHours: 27,
    durationHours: 1.5,
  },
  {
    email: 'dj-saga@tahti.live',
    username: 'dj-saga',
    displayName: 'DJ Saga',
    note: 'Finnish folktronica showcase',
    startInHours: 52,
    durationHours: 2,
  },
]

async function ensureDjChannel(spec: DjSpec): Promise<{ channelId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    include: { channel: true },
  })
  if (existing?.channel) return { channelId: existing.channel.id }

  const channelData = {
    slug: spec.username,
    liveSourceMount: `/live/${spec.username}`,
    liveSourcePass: `${spec.username}-pass`,
    liveSourcePassHash: await hashPassword(`${spec.username}-pass`),
    rtmpStreamKey: `${spec.username}__radio-dj`,
    rtmpStreamKeyHash: await hashPassword(`${spec.username}__radio-dj`),
  }

  if (existing) {
    const channel = await prisma.channel.create({ data: { ...channelData, userId: existing.id } })
    return { channelId: channel.id }
  }

  const created = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash: await hashPassword(`radio-dj-${spec.username}-pass`),
      username: spec.username,
      displayName: spec.displayName,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      membership: { create: { status: 'PENDING_PAYMENT' } },
      channel: { create: channelData },
    },
    include: { channel: true },
  })
  return { channelId: created.channel!.id }
}

async function main() {
  const results: Array<{ username: string; startAt: Date; endAt: Date; note: string }> = []

  for (const spec of DJS) {
    const { channelId } = await ensureDjChannel(spec)
    await prisma.radioSlotBooking.deleteMany({ where: { channelId } })

    const startAt = new Date(Date.now() + spec.startInHours * 60 * 60 * 1000)
    const endAt = new Date(startAt.getTime() + spec.durationHours * 60 * 60 * 1000)
    await prisma.radioSlotBooking.create({
      data: { channelId, startAt, endAt, note: spec.note },
    })
    results.push({ username: spec.username, startAt, endAt, note: spec.note })
  }

  console.log(JSON.stringify({ ok: true, booked: results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
