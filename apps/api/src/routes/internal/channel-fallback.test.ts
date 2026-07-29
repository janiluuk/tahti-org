// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { createReadyArchiveItem, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channel-fallback-'

describe('GET /internal/channels/:channelId/fallback.m3u', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98392,
    })
    channelId = artist.channel!.id
    await createReadyArchiveItem(prisma, channelId, 'Fallback track')
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('requires internal auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
    })
    expect(res.statusCode).toBe(401)
    expect(res.body).toBe('unauthorized')
  })

  it('returns extended M3U for ready archive items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('audio/x-mpegurl')
    expect(res.body).toContain('#EXTM3U')
    expect(res.body).toContain('Fallback track')
  })

  it('accepts auth via ?secret= query param (Liquidsoap playlist() can not send headers)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u?secret=${config.internalSecret}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Fallback track')
  })

  it('rejects a wrong ?secret= query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u?secret=wrong`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/internal/channels/missing-channel/fallback.m3u',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('M33: returns an empty playlist when fallbackEnabled is false', async () => {
    await prisma.channel.update({ where: { id: channelId }, data: { fallbackEnabled: false } })

    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('Fallback track')
    expect(res.body).toContain('no items yet')

    await prisma.channel.update({ where: { id: channelId }, data: { fallbackEnabled: true } })
  })

  it('Manage tab playlist switch: plays the chosen Collection instead of the default isFallback set', async () => {
    const collectionItem = await createReadyArchiveItem(prisma, channelId, 'Collection-only track')
    const artist = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { userId: true },
    })
    const collection = await prisma.collection.create({
      data: { userId: artist.userId, slug: `${PREFIX}collection`, name: 'Switched playlist' },
    })
    await prisma.collectionItem.create({
      data: { collectionId: collection.id, archiveItemId: collectionItem.id, position: 0 },
    })
    await prisma.channel.update({
      where: { id: channelId },
      data: { activeFallbackCollectionId: collection.id },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Collection-only track')
    expect(res.body).not.toContain('Fallback track')

    await prisma.channel.update({
      where: { id: channelId },
      data: { activeFallbackCollectionId: null },
    })
  })

  it('falls through to the default rotation when the chosen Collection has no playable tracks', async () => {
    const artist = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { userId: true },
    })
    const emptyCollection = await prisma.collection.create({
      data: { userId: artist.userId, slug: `${PREFIX}empty-collection`, name: 'Empty playlist' },
    })
    await prisma.channel.update({
      where: { id: channelId },
      data: { activeFallbackCollectionId: emptyCollection.id },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Fallback track')

    await prisma.channel.update({
      where: { id: channelId },
      data: { activeFallbackCollectionId: null },
    })
  })
})

describe('GET /internal/channels/:channelId/fallback.m3u — Tahti Radio relays Tahti Selects', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let radioChannelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const radio = await createTestArtist(prisma, {
      email: `${PREFIX}radio@example.com`,
      username: `${PREFIX}radio`,
      tier: 'ARTIST',
    })
    radioChannelId = radio.channel!.id
    await prisma.channel.update({
      where: { id: radioChannelId },
      data: { slug: TAHTI_RADIO_SLUG },
    })

    const selects = await createTestArtist(prisma, {
      email: `${PREFIX}selects@example.com`,
      username: `${PREFIX}selects`,
      tier: 'ARTIST',
    })
    await prisma.channel.update({
      where: { id: selects.channel!.id },
      data: { slug: TAHTI_SELECTS_SLUG },
    })
    const rotationTrack = await createReadyArchiveItem(
      prisma,
      selects.channel!.id,
      'Selects rotation track',
    )
    await prisma.curatedRotationItem.create({
      data: {
        channelId: selects.channel!.id,
        archiveItemId: rotationTrack.id,
        position: 0,
        addedById: selects.id,
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('relays the Tahti Selects rotation when Tahti Radio has no bookings or archive', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${radioChannelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Selects rotation track')
  })

  it('still relays Tahti Selects even when Tahti Radio has fallbackEnabled off — the platform station must never go silent regardless of that per-artist toggle', async () => {
    await prisma.channel.update({
      where: { id: radioChannelId },
      data: { fallbackEnabled: false },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/internal/channels/${radioChannelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Selects rotation track')

    await prisma.channel.update({
      where: { id: radioChannelId },
      data: { fallbackEnabled: true },
    })
  })
})

describe('GET /internal/channels/:channelId/fallback.m3u — announcements', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.announcementSettings.deleteMany({})

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}announce-artist@example.com`,
      username: `${PREFIX}announce-artist`,
      tier: 'ARTIST',
    })
    channelId = artist.channel!.id
    await createReadyArchiveItem(prisma, channelId, 'Announce track one')
    await createReadyArchiveItem(prisma, channelId, 'Announce track two')
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.announcementSettings.deleteMany({})
    await app.close()
  })

  async function fetchM3u() {
    return app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
  }

  it('does not affect the M3U when there are no announcement clips at all', async () => {
    const res = await fetchM3u()
    expect(res.body).toContain('Announce track one')
    expect(res.body).toContain('Announce track two')
    // exactly 2 tracks worth of #EXTINF lines, nothing extra
    expect((res.body.match(/#EXTINF/g) ?? []).length).toBe(2)
  })

  it('interleaves an AFTER_EVERY system clip after every track', async () => {
    const clip = await prisma.announcementClip.create({
      data: {
        channelId: null,
        title: 'System ID',
        audioKey: 'announcements/system/id.mp3',
        originalAudioKey: 'announcements/system/id.mp3',
        scheduleMode: 'AFTER_EVERY',
      },
    })

    const res = await fetchM3u()
    expect((res.body.match(/System ID/g) ?? []).length).toBe(2)

    await prisma.announcementClip.delete({ where: { id: clip.id } })
  })

  it('a disabled system clip never appears', async () => {
    const clip = await prisma.announcementClip.create({
      data: {
        channelId: null,
        title: 'Disabled Announcement',
        audioKey: 'announcements/system/off.mp3',
        originalAudioKey: 'announcements/system/off.mp3',
        scheduleMode: 'AFTER_EVERY',
        isEnabled: false,
      },
    })

    const res = await fetchM3u()
    expect(res.body).not.toContain('Disabled Announcement')

    await prisma.announcementClip.delete({ where: { id: clip.id } })
  })

  it('the global system-announcements kill-switch suppresses even an enabled clip', async () => {
    const clip = await prisma.announcementClip.create({
      data: {
        channelId: null,
        title: 'Killswitched Announcement',
        audioKey: 'announcements/system/kill.mp3',
        originalAudioKey: 'announcements/system/kill.mp3',
        scheduleMode: 'AFTER_EVERY',
      },
    })
    await prisma.announcementSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', systemEnabled: false },
      update: { systemEnabled: false },
    })

    const res = await fetchM3u()
    expect(res.body).not.toContain('Killswitched Announcement')

    await prisma.announcementSettings.update({
      where: { id: 'global' },
      data: { systemEnabled: true },
    })
    await prisma.announcementClip.delete({ where: { id: clip.id } })
  })

  it("a channel's own announcement is suppressed when the channel disables announcements", async () => {
    const clip = await prisma.announcementClip.create({
      data: {
        channelId,
        title: 'My Own Jingle',
        audioKey: 'announcements/own/jingle.mp3',
        originalAudioKey: 'announcements/own/jingle.mp3',
      },
    })
    await prisma.channel.update({ where: { id: channelId }, data: { announcementsEnabled: false } })

    // RANDOM spacing is probabilistic — run several times to be confident it never appears
    for (let i = 0; i < 20; i++) {
      const res = await fetchM3u()
      expect(res.body).not.toContain('My Own Jingle')
    }

    await prisma.channel.update({ where: { id: channelId }, data: { announcementsEnabled: true } })
    await prisma.announcementClip.delete({ where: { id: clip.id } })
  })
})
