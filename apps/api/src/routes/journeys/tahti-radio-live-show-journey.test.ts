// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Tahti Radio live-show arc (API e2e):
 *   rotation plays a track → DJ goes live → ~1 minute on air →
 *   announcement → show continues on rotation.
 *
 * Durations are backdated (same pattern as vital-flows' 30s broadcast) —
 * no wall-clock sleep for the live minute.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  allocateMemberNumber,
  createReadySound,
  createTahtiRadioChannel,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const { enqueueFinalizeBroadcastRecording, enqueueWarmSoundFallbackCache } = vi.hoisted(() => ({
  enqueueFinalizeBroadcastRecording: vi.fn().mockResolvedValue(undefined),
  enqueueWarmSoundFallbackCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return {
    ...actual,
    enqueueFinalizeBroadcastRecording,
    enqueueWarmSoundFallbackCache,
  }
})

const PREFIX = 'journey-radio-show-'
const DJ_USERNAME = `${PREFIX}dj`
const TRACK_TITLE = 'E2E Radio Rotation Track'
const STATION_ID_TITLE = 'E2E Station ID'
const CHAT_ANNOUNCE_BODY = 'E2E: live set wrapping — stay tuned'
const LIVE_MS = 60_000

describe('Tahti Radio live-show journey', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let radioChannelId: string
  let radioUserId: string
  let stationClipId: string | null = null

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const radio = await createTahtiRadioChannel(prisma)
    radioUserId = radio.id
    radioChannelId = radio.channel!.id

    await createReadySound(prisma, radioChannelId, TRACK_TITLE)

    const clip = await prisma.announcementClip.create({
      data: {
        channelId: null,
        title: STATION_ID_TITLE,
        audioKey: `announcements/system/${PREFIX}id.mp3`,
        originalAudioKey: `announcements/system/${PREFIX}id.mp3`,
        scheduleMode: 'AFTER_EVERY',
        isEnabled: true,
      },
    })
    stationClipId = clip.id

    await prisma.announcementSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', systemEnabled: true },
      update: { systemEnabled: true },
    })
  })

  afterAll(async () => {
    if (stationClipId) {
      await prisma.announcementClip.deleteMany({ where: { id: stationClipId } })
    }
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, 'tahti-radio@')
    await app.close()
  })

  it('plays a rotation track, hosts a 1-minute live set, announces, then continues', async () => {
    enqueueFinalizeBroadcastRecording.mockClear()

    // ── 1. Tahti Radio plays a track (curated/fallback rotation + station ID) ─
    const m3uBefore = await app.inject({
      method: 'GET',
      url: `/internal/channels/${radioChannelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(m3uBefore.statusCode).toBe(200)
    expect(m3uBefore.body).toContain(TRACK_TITLE)
    expect(m3uBefore.body).toContain(STATION_ID_TITLE)

    const radioChannel = await app.inject({
      method: 'GET',
      url: `/api/channels/${TAHTI_RADIO_SLUG}`,
    })
    expect(radioChannel.statusCode).toBe(200)
    expect(radioChannel.json().state).toBe('LIVE')

    // ── 2. DJ books an active slot and goes live into Tahti Radio ───────────
    const dj = await createTestArtist(prisma, {
      email: `${PREFIX}dj@example.com`,
      username: DJ_USERNAME,
      displayName: 'E2E Radio Show DJ',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    const djChannel = await prisma.channel.findUniqueOrThrow({ where: { id: dj.channel!.id } })

    const slotStart = new Date(Date.now() - 5 * 60_000)
    const slotEnd = new Date(Date.now() + 55 * 60_000)
    await prisma.radioSlotBooking.create({
      data: {
        channelId: djChannel.id,
        startAt: slotStart,
        endAt: slotEnd,
        note: 'E2E live hour',
      },
    })
    // Switchover job would set this; set directly so the journey does not need
    // the worker/orchestrator stack.
    await prisma.channel.update({
      where: { id: radioChannelId },
      data: { liveInputOverrideSlug: DJ_USERNAME },
    })

    const slots = await app.inject({
      method: 'GET',
      url: `/api/v1/radio/slots?from=${new Date(Date.now() - 60_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`,
    })
    expect(slots.statusCode).toBe(200)
    const slotRows = slots.json() as Array<{
      artist: { channelSlug: string; displayName: string }
    }>
    expect(slotRows.some((s) => s.artist.channelSlug === DJ_USERNAME)).toBe(true)

    const connect = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: `/live/${djChannel.slug}`, pass: djChannel.liveSourcePass },
    })
    expect(connect.statusCode).toBe(200)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: djChannel.id } })).state).toBe(
      'PREVIEW',
    )

    const djCookie = await sessionCookieFor(prisma, dj.id)
    const goLive = await app.inject({
      method: 'POST',
      url: '/api/me/channel/go-live',
      headers: { cookie: djCookie },
    })
    expect(goLive.statusCode).toBe(200)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: djChannel.id } })).state).toBe(
      'LIVE',
    )

    const liveList = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/radio/current-live',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(liveList.statusCode).toBe(200)
    const liveSlugs = (liveList.json() as Array<{ slug: string }>).map((c) => c.slug)
    expect(liveSlugs).toContain(DJ_USERNAME)

    // ── 3. Stream ~1 minute (backdated; no wall-clock wait) ─────────────────
    const broadcast = await prisma.broadcast.findFirstOrThrow({
      where: { channelId: djChannel.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { startedAt: new Date(Date.now() - LIVE_MS) },
    })

    // ── 4. Announcement after the live minute ───────────────────────────────
    const radioCookie = await sessionCookieFor(prisma, radioUserId)
    const pin = await app.inject({
      method: 'POST',
      url: '/api/me/chat/announcements',
      headers: { cookie: radioCookie, 'content-type': 'application/json' },
      payload: { body: CHAT_ANNOUNCE_BODY },
    })
    expect(pin.statusCode).toBe(201)

    const announcements = await app.inject({
      method: 'GET',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/announcements`,
    })
    expect(announcements.statusCode).toBe(200)
    expect(
      (announcements.json() as Array<{ body: string }>).some((a) =>
        a.body.includes(CHAT_ANNOUNCE_BODY),
      ),
    ).toBe(true)

    // ── 5. End live → rotation (track + station ID) continues ───────────────
    const disconnect = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      payload: { mount: `/live/${djChannel.slug}` },
    })
    expect(disconnect.statusCode).toBe(200)
    expect(enqueueFinalizeBroadcastRecording).toHaveBeenCalledWith(broadcast.id)

    const ended = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
    expect(ended.endedAt).toBeTruthy()
    expect(ended.endedAt!.getTime() - ended.startedAt.getTime()).toBeGreaterThanOrEqual(LIVE_MS)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: djChannel.id } })).state).toBe(
      'OFFLINE',
    )

    await prisma.radioSlotBooking.deleteMany({ where: { channelId: djChannel.id } })
    await prisma.channel.update({
      where: { id: radioChannelId },
      data: { liveInputOverrideSlug: null },
    })

    const m3uAfter = await app.inject({
      method: 'GET',
      url: `/internal/channels/${radioChannelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(m3uAfter.statusCode).toBe(200)
    expect(m3uAfter.body).toContain(TRACK_TITLE)
    expect(m3uAfter.body).toContain(STATION_ID_TITLE)

    const radioStillOn = await app.inject({
      method: 'GET',
      url: `/api/channels/${TAHTI_RADIO_SLUG}`,
    })
    expect(radioStillOn.statusCode).toBe(200)
    expect(radioStillOn.json().state).toBe('LIVE')
    expect(
      (
        await prisma.channel.findUniqueOrThrow({
          where: { id: radioChannelId },
          select: { liveInputOverrideSlug: true },
        })
      ).liveInputOverrideSlug,
    ).toBeNull()
  })
})
