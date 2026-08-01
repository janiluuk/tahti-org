// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds fixtures for tests/e2e/radio-live-show.mjs:
 *   - ensures Tahti Radio channel exists (LIVE)
 *   - DJ artist with Icecast + RTMP credentials
 *   - active radio slot booking (already started)
 *   - AFTER_EVERY system announcement clip title used by the journey
 *
 * Usage (from apps/api):
 *   npx tsx scripts/seed-e2e-radio-live-show.ts
 *   npx tsx scripts/seed-e2e-radio-live-show.ts backdate [ms]
 *   npx tsx scripts/seed-e2e-radio-live-show.ts announce
 *   npx tsx scripts/seed-e2e-radio-live-show.ts clear
 */

import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { hashPassword } from '../src/lib/password.js'

export const E2E_PASS = 'e2e-radio-live-show-pass'

export const RADIO_SHOW_DJ = {
  email: 'e2e-radio-show-dj@e2e.tahti.live',
  username: 'e2e-radio-show-dj',
  displayName: 'E2E Radio Show DJ',
}

export const STATION_ID_TITLE = 'E2E Radio Show Station ID'
export const CHAT_ANNOUNCE_BODY = 'E2E: thanks for listening — the show continues'
export const RTMP_STREAM_KEY = `${RADIO_SHOW_DJ.username}__e2eradioshow`

async function ensureRadioChannel(): Promise<{ id: string; userId: string }> {
  const existing = await prisma.channel.findUnique({
    where: { slug: TAHTI_RADIO_SLUG },
    select: { id: true, userId: true },
  })
  if (existing) {
    await prisma.channel.update({
      where: { id: existing.id },
      data: { state: 'LIVE', liveInputOverrideSlug: null },
    })
    return existing
  }

  const passwordHash = await hashPassword(E2E_PASS)
  const created = await prisma.user.create({
    data: {
      email: 'tahti-radio@e2e.tahti.live',
      passwordHash,
      username: TAHTI_RADIO_SLUG,
      displayName: 'Tahti Radio',
      emailVerifiedAt: new Date(),
      tier: 'STUDIO',
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      channel: {
        create: {
          slug: TAHTI_RADIO_SLUG,
          state: 'LIVE',
          liveSourceMount: `/live/${TAHTI_RADIO_SLUG}`,
          liveSourcePass: `${TAHTI_RADIO_SLUG}-pass`,
          liveSourcePassHash: await hashPassword(`${TAHTI_RADIO_SLUG}-pass`),
          rtmpStreamKey: `${TAHTI_RADIO_SLUG}__seed`,
          rtmpStreamKeyHash: await hashPassword(`${TAHTI_RADIO_SLUG}__seed`),
        },
      },
    },
    include: { channel: true },
  })
  return { id: created.channel!.id, userId: created.id }
}

async function ensureDj(): Promise<{
  id: string
  channelId: string
  liveSourcePass: string
  rtmpStreamKey: string
}> {
  const liveSourcePass = `${RADIO_SHOW_DJ.username}-pass`
  const existing = await prisma.user.findUnique({
    where: { email: RADIO_SHOW_DJ.email },
    include: { channel: true },
  })

  const channelData = {
    slug: RADIO_SHOW_DJ.username,
    liveSourceMount: `/live/${RADIO_SHOW_DJ.username}`,
    liveSourcePass,
    liveSourcePassHash: await hashPassword(liveSourcePass),
    rtmpStreamKey: RTMP_STREAM_KEY,
    rtmpStreamKeyHash: await hashPassword(RTMP_STREAM_KEY),
    state: 'OFFLINE' as const,
    goneLiveAt: null,
  }

  if (existing?.channel) {
    await prisma.channel.update({ where: { id: existing.channel.id }, data: channelData })
    return {
      id: existing.id,
      channelId: existing.channel.id,
      liveSourcePass,
      rtmpStreamKey: RTMP_STREAM_KEY,
    }
  }

  if (existing) {
    const channel = await prisma.channel.create({
      data: { ...channelData, userId: existing.id },
    })
    return {
      id: existing.id,
      channelId: channel.id,
      liveSourcePass,
      rtmpStreamKey: RTMP_STREAM_KEY,
    }
  }

  const created = await prisma.user.create({
    data: {
      email: RADIO_SHOW_DJ.email,
      passwordHash: await hashPassword(E2E_PASS),
      username: RADIO_SHOW_DJ.username,
      displayName: RADIO_SHOW_DJ.displayName,
      emailVerifiedAt: new Date(),
      tier: 'ARTIST',
      membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      channel: { create: channelData },
    },
    include: { channel: true },
  })
  return {
    id: created.id,
    channelId: created.channel!.id,
    liveSourcePass,
    rtmpStreamKey: RTMP_STREAM_KEY,
  }
}

async function seed() {
  const radio = await ensureRadioChannel()
  const dj = await ensureDj()

  await prisma.radioSlotBooking.deleteMany({ where: { channelId: dj.channelId } })
  const startAt = new Date(Date.now() - 5 * 60_000)
  const endAt = new Date(Date.now() + 55 * 60_000)
  await prisma.radioSlotBooking.create({
    data: {
      channelId: dj.channelId,
      startAt,
      endAt,
      note: 'E2E radio live show',
    },
  })

  await prisma.channel.update({
    where: { id: radio.id },
    data: { liveInputOverrideSlug: RADIO_SHOW_DJ.username, state: 'LIVE' },
  })

  await prisma.announcementClip.deleteMany({ where: { title: STATION_ID_TITLE } })
  await prisma.announcementClip.create({
    data: {
      channelId: null,
      title: STATION_ID_TITLE,
      audioKey: 'announcements/system/e2e-radio-live-show.mp3',
      originalAudioKey: 'announcements/system/e2e-radio-live-show.mp3',
      scheduleMode: 'AFTER_EVERY',
      isEnabled: true,
    },
  })
  await prisma.announcementSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global', systemEnabled: true },
    update: { systemEnabled: true },
  })

  console.log(
    JSON.stringify({
      ok: true,
      email: RADIO_SHOW_DJ.email,
      username: RADIO_SHOW_DJ.username,
      displayName: RADIO_SHOW_DJ.displayName,
      password: E2E_PASS,
      liveSourcePass: dj.liveSourcePass,
      rtmpStreamKey: dj.rtmpStreamKey,
      radioSlug: TAHTI_RADIO_SLUG,
      radioChannelId: radio.id,
      radioUserId: radio.userId,
      stationIdTitle: STATION_ID_TITLE,
      chatAnnounceBody: CHAT_ANNOUNCE_BODY,
      slotStartAt: startAt.toISOString(),
      slotEndAt: endAt.toISOString(),
    }),
  )
}

async function clear() {
  const dj = await prisma.user.findUnique({
    where: { email: RADIO_SHOW_DJ.email },
    include: { channel: true },
  })
  if (dj?.channel) {
    await prisma.radioSlotBooking.deleteMany({ where: { channelId: dj.channel.id } })
    await prisma.broadcast.updateMany({
      where: { channelId: dj.channel.id, endedAt: null },
      data: { endedAt: new Date() },
    })
    await prisma.channel.update({
      where: { id: dj.channel.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
  }
  const radio = await prisma.channel.findUnique({ where: { slug: TAHTI_RADIO_SLUG } })
  if (radio) {
    await prisma.channel.update({
      where: { id: radio.id },
      data: { liveInputOverrideSlug: null },
    })
  }
  await prisma.announcementClip.deleteMany({ where: { title: STATION_ID_TITLE } })
  console.log(JSON.stringify({ ok: true, cleared: true }))
}

/** Backdate the DJ's open broadcast so the session looks ~1 minute long. */
async function backdateLive(ms = 60_000) {
  const ch = await prisma.channel.findUniqueOrThrow({
    where: { slug: RADIO_SHOW_DJ.username },
  })
  const b = await prisma.broadcast.findFirst({
    where: { channelId: ch.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })
  if (!b) {
    console.log(JSON.stringify({ ok: false, reason: 'no open broadcast' }))
    return
  }
  await prisma.broadcast.update({
    where: { id: b.id },
    data: { startedAt: new Date(Date.now() - ms) },
  })
  console.log(JSON.stringify({ ok: true, broadcastId: b.id, liveMs: ms }))
}

async function pinAnnouncement() {
  const radio = await prisma.channel.findUniqueOrThrow({ where: { slug: TAHTI_RADIO_SLUG } })
  await prisma.channelAnnouncement.deleteMany({
    where: { channelId: radio.id, body: CHAT_ANNOUNCE_BODY },
  })
  const row = await prisma.channelAnnouncement.create({
    data: { channelId: radio.id, body: CHAT_ANNOUNCE_BODY },
  })
  console.log(JSON.stringify({ ok: true, id: row.id, body: CHAT_ANNOUNCE_BODY }))
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'clear') await clear()
  else if (mode === 'backdate') await backdateLive(Number(process.argv[3] ?? 60_000))
  else if (mode === 'announce') await pinAnnouncement()
  else await seed()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
