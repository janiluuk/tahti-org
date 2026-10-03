// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://minio.test/${key}`),
}))

import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-selects-audio-'

describe('/api/admin/tahti-selects preview audio', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let playableId: string
  let unplayableId: string
  const rotationItemIds: string[] = []

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      // Older accounts can still hold an email display name the API now rejects.
      displayName: 'board@example.com',
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    let selectsChannel = await prisma.channel.findUnique({
      where: { slug: TAHTI_SELECTS_SLUG },
      select: { id: true },
    })
    if (!selectsChannel) {
      const selects = await createTestArtist(prisma, {
        email: `${PREFIX}selects@example.com`,
        username: TAHTI_SELECTS_SLUG,
      })
      selectsChannel = { id: selects.channel!.id }
    }

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
      },
    })
    playableId = playable.id
    const unplayable = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX}unplayable`,
        status: 'READY',
        isPublic: true,
      },
    })
    unplayableId = unplayable.id

    for (const [index, soundId] of [playableId, unplayableId].entries()) {
      const item = await prisma.curatedRotationItem.create({
        data: {
          channelId: selectsChannel.id,
          soundId,
          position: 10_000 + index,
          addedById: board.id,
        },
      })
      rotationItemIds.push(item.id)
    }
  })

  afterAll(async () => {
    await prisma.curatedRotationItem.deleteMany({ where: { id: { in: rotationItemIds } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns a presigned preview url for each rotation item', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/tahti-selects',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{ soundId: string; audioUrl: string | null }>
    expect(items.find((i) => i.soundId === playableId)?.audioUrl).toBe(
      `https://minio.test/${PREFIX}playable.flac`,
    )
    expect(items.find((i) => i.soundId === unplayableId)?.audioUrl).toBeNull()
  })

  it('never names the curator or artist by an email address', async () => {
    const rotation = await app.inject({
      method: 'GET',
      url: '/api/admin/tahti-selects',
      headers: { cookie: boardCookie },
    })
    expect(rotation.statusCode).toBe(200)
    const item = (
      rotation.json().items as Array<{ soundId: string; addedBy: string; artistName: string }>
    ).find((i) => i.soundId === playableId)
    expect(item?.addedBy).toBe(`${PREFIX}board`)
    expect(item?.artistName).toBe(`${PREFIX}artist`)

    const browse = await app.inject({
      method: 'GET',
      url: `/api/admin/tahti-selects/browse?q=${PREFIX}`,
      headers: { cookie: boardCookie },
    })
    expect(browse.statusCode).toBe(200)
    const result = (browse.json().items as Array<{ id: string; artistName: string }>).find(
      (i) => i.id === playableId,
    )
    expect(result?.artistName).toBe(`${PREFIX}artist`)
  })

  it('returns a presigned preview url for each browse result', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/tahti-selects/browse?q=${PREFIX}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{ id: string; audioUrl: string | null }>
    expect(items.find((i) => i.id === playableId)?.audioUrl).toBe(
      `https://minio.test/${PREFIX}playable.flac`,
    )
    expect(items.find((i) => i.id === unplayableId)?.audioUrl).toBeNull()
  })
})
