// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://minio.test/${key}`),
}))

import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-radio-playlist-'

describe('/api/admin/tahti-radio curated rotation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string
  let radioChannelId: string
  let playableId: string
  let secondId: string
  const rotationItemIds: string[] = []

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      displayName: 'board@example.com',
      isBoard: true,
      isMember: true,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)

    let radioChannel = await prisma.channel.findUnique({
      where: { slug: TAHTI_RADIO_SLUG },
      select: { id: true },
    })
    if (!radioChannel) {
      const radio = await createTestArtist(prisma, {
        email: `${PREFIX}radio@example.com`,
        username: TAHTI_RADIO_SLUG,
      })
      radioChannel = { id: radio.channel!.id }
    }
    radioChannelId = radioChannel.id

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'artist@example.com',
    })
    const playable = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX}playable`,
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}playable.mp3`,
        flacKey: `${PREFIX}playable.flac`,
        durationSec: 120,
      },
    })
    playableId = playable.id
    const second = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX}second`,
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}second.mp3`,
        durationSec: 90,
      },
    })
    secondId = second.id

    const seeded = await prisma.curatedRotationItem.create({
      data: {
        channelId: radioChannelId,
        soundId: playableId,
        position: 20_000,
        addedById: boardId,
      },
    })
    rotationItemIds.push(seeded.id)
  })

  afterAll(async () => {
    await prisma.curatedRotationItem.deleteMany({
      where: {
        OR: [{ id: { in: rotationItemIds } }, { channelId: radioChannelId, soundId: secondId }],
      },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists rotation items with preview audio urls', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tahti-radio',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{
      soundId: string
      audioUrl: string | null
      artistName: string
      addedBy: string
    }>
    const row = items.find((i) => i.soundId === playableId)
    expect(row?.audioUrl).toBe(`https://minio.test/${PREFIX}playable.flac`)
    expect(row?.artistName).toBe(`${PREFIX}artist`)
    expect(row?.addedBy).toBe(`${PREFIX}board`)
  })

  it('browses READY public sounds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/tahti-radio/browse?q=${PREFIX}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{ id: string; audioUrl: string | null }>
    expect(items.find((i) => i.id === playableId)?.audioUrl).toBe(
      `https://minio.test/${PREFIX}playable.flac`,
    )
    expect(items.some((i) => i.id === secondId)).toBe(true)
  })

  it('adds, reorders, and removes rotation items', async () => {
    const add = await app.inject({
      method: 'POST',
      url: '/api/admin/tahti-radio/items',
      headers: { cookie: boardCookie },
      payload: { soundId: secondId },
    })
    expect(add.statusCode).toBe(201)
    const addedId = (add.json() as { id: string }).id
    rotationItemIds.push(addedId)

    const again = await app.inject({
      method: 'POST',
      url: '/api/admin/tahti-radio/items',
      headers: { cookie: boardCookie },
      payload: { soundId: secondId },
    })
    expect(again.statusCode).toBe(409)

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/tahti-radio',
      headers: { cookie: boardCookie },
    })
    const ours = (list.json().items as Array<{ id: string; soundId: string }>).filter(
      (i) => i.soundId === playableId || i.soundId === secondId,
    )
    expect(ours).toHaveLength(2)

    const reorder = await app.inject({
      method: 'PATCH',
      url: `/api/admin/tahti-radio/items/${addedId}/reorder`,
      headers: { cookie: boardCookie },
      payload: { position: 0 },
    })
    expect(reorder.statusCode).toBe(200)

    const full = (
      (
        await app.inject({
          method: 'GET',
          url: '/api/admin/tahti-radio',
          headers: { cookie: boardCookie },
        })
      ).json().items as Array<{ id: string }>
    ).map((i) => i.id)
    const bulk = await app.inject({
      method: 'PUT',
      url: '/api/admin/tahti-radio/reorder',
      headers: { cookie: boardCookie },
      payload: { itemIds: full },
    })
    expect(bulk.statusCode).toBe(200)

    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/admin/tahti-radio/items/${addedId}`,
      headers: { cookie: boardCookie },
    })
    expect(remove.statusCode).toBe(200)
  })
})
