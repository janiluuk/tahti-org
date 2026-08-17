// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'radio-rotation-test-'

describe('M16 — Tahti Radio now-playing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('reports offline when no RadioSlotBooking covers the current time', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ live: false, channel: null })
  })

  it('reports live with the booked artist during their RadioSlotBooking window', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}onair@example.com`,
      username: `${PREFIX}onair`,
      displayName: 'On Air',
    })
    const now = new Date()
    await prisma.radioSlotBooking.create({
      data: {
        channelId: artist.channel!.id,
        startAt: new Date(now.getTime() - 5 * 60 * 1000),
        endAt: new Date(now.getTime() + 5 * 60 * 1000),
      },
    })

    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      live: true,
      channel: { slug: artist.channel!.slug, artistName: 'On Air' },
    })
  })

  it('returns an empty rotation when Tahti Radio has no channel yet', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/rotation' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

describe('STREAM-011 — Tahti Radio rotation preview', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let radioChannelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    // Other test files (journey specs) also seed a TAHTI_RADIO_SLUG fixture via
    // createTahtiRadioChannel() and leave it in place as a long-lived shared
    // fixture — clean up any leftover before claiming the username ourselves.
    const staleRadio = await prisma.user.findUnique({ where: { username: TAHTI_RADIO_SLUG } })
    if (staleRadio) {
      const emailPrefix = staleRadio.email.slice(0, staleRadio.email.indexOf('@') + 1)
      await cleanupUsersByEmailPrefix(prisma, emailPrefix)
    }

    const radioArtist = await createTestArtist(prisma, {
      email: `${PREFIX}radio@example.com`,
      username: TAHTI_RADIO_SLUG,
      displayName: 'Tahti Radio',
    })
    radioChannelId = radioArtist.channel!.id

    const trackArtist = await createTestArtist(prisma, {
      email: `${PREFIX}track-artist@example.com`,
      username: `${PREFIX}track-artist`,
      displayName: 'Rotation Test Artist',
    })

    const first = await prisma.archiveItem.create({
      data: {
        channelId: trackArtist.channel!.id,
        title: 'Rotation Track One',
        status: 'READY',
        isPublic: true,
      },
    })
    const second = await prisma.archiveItem.create({
      data: {
        channelId: trackArtist.channel!.id,
        title: 'Rotation Track Two',
        status: 'READY',
        isPublic: true,
      },
    })

    await prisma.curatedRotationItem.create({
      data: {
        channelId: radioChannelId,
        archiveItemId: second.id,
        position: 1,
        addedById: radioArtist.id,
      },
    })
    await prisma.curatedRotationItem.create({
      data: {
        channelId: radioChannelId,
        archiveItemId: first.id,
        position: 0,
        addedById: radioArtist.id,
      },
    })
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('returns the curated rotation in admin-set position order', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/rotation' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ title: string; artistName: string; artistUsername: string }>
    expect(body.map((b) => b.title)).toEqual(['Rotation Track One', 'Rotation Track Two'])
    expect(body.every((b) => b.artistName === 'Rotation Test Artist')).toBe(true)
    expect(body.every((b) => b.artistUsername === `${PREFIX}track-artist`)).toBe(true)
  })
})

describe('public live-artist slot calendar', () => {
  const PREFIX2 = 'radio-slots-test-'
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX2)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX2}artist@example.com`,
      username: `${PREFIX2}artist`,
      displayName: 'Slot Test Artist',
    })
    channelId = artist.channel!.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX2)
  })

  it('rejects a query without from/to', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/slots' })
    expect(res.statusCode).toBe(400)
  })

  it('lists a booked slot with public artist info, no auth required', async () => {
    const startAt = new Date()
    startAt.setUTCMinutes(0, 0, 0)
    startAt.setUTCDate(startAt.getUTCDate() + 1)
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)

    await prisma.radioSlotBooking.create({
      data: { channelId, startAt, endAt, note: 'Test live set' },
    })

    const from = new Date(startAt.getTime() - 3600_000).toISOString()
    const to = new Date(endAt.getTime() + 3600_000).toISOString()
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/radio/slots?from=${from}&to=${to}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{
      note: string | null
      artist: { displayName: string; username: string; channelSlug: string | null }
    }>
    expect(body).toHaveLength(1)
    expect(body[0]?.note).toBe('Test live set')
    expect(body[0]?.artist.displayName).toBe('Slot Test Artist')
    expect(body[0]?.artist.username).toBe(`${PREFIX2}artist`)
    expect(body[0]?.artist.channelSlug).toBe(`${PREFIX2}artist`)
  })
})
