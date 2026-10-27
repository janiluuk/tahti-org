// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'export-chat-'

describe('GET /api/me/data-export.json — chat and reactions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, fan.id)
    channelId = artist.channel!.id
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Live set', status: 'READY', isPublic: true },
    })
    await prisma.chatMessage.createMany({
      data: [
        { channelId, userId: fan.id, handle: 'fan', text: 'Hello from the front row' },
        { channelId, userId: artist.id, handle: 'artist', text: 'Not the fan' },
        { channelId, handle: 'anon', text: 'Signed out', fingerprintHash: 'abc' },
      ],
    })
    await prisma.trackReaction.create({
      data: { soundId: sound.id, userId: fan.id, type: 'LOVE', positionSec: 42.5 },
    })
  })

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists only the account’s own chat messages and its reactions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.chatMessages).toHaveLength(1)
    expect(body.chatMessages[0]).toMatchObject({
      text: 'Hello from the front row',
      channel: { slug: expect.any(String) },
    })
    expect(body.trackReactions).toHaveLength(1)
    expect(body.trackReactions[0]).toMatchObject({
      type: 'LOVE',
      positionSec: 42.5,
      sound: { title: 'Live set' },
    })
  })
})
