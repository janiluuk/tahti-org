// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'track-reactions-blocks-'

describe('/api/reactions/track/:id with blocks and suspended artists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let fanId: string
  let fanCookie: string
  let soundId: string

  const post = () =>
    app.inject({
      method: 'POST',
      url: `/api/reactions/track/${soundId}`,
      headers: { cookie: fanCookie },
      payload: { type: 'HANDS_UP', positionSec: 10 },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    ownerId = owner.id
    fanId = fan.id
    fanCookie = await sessionCookieFor(prisma, fan.id)
    const item = await prisma.sound.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Blocked Reaction Track',
        status: 'READY',
        isPublic: true,
        durationSec: 120,
      },
    })
    soundId = item.id
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await prisma.userBlock.deleteMany({ where: { blockerUserId: { in: [ownerId, fanId] } } })
    await prisma.user.update({ where: { id: ownerId }, data: { suspendedAt: null } })
    await prisma.trackReaction.deleteMany({ where: { soundId } })
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('accepts a reaction when nobody is blocked', async () => {
    expect((await post()).statusCode).toBe(201)
  })

  it('answers 404 and stores nothing when the artist blocked the listener', async () => {
    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: fanId } })
    expect((await post()).statusCode).toBe(404)
    expect(await prisma.trackReaction.count({ where: { soundId } })).toBe(0)
  })

  it('answers 404 when the listener blocked the artist', async () => {
    await prisma.userBlock.create({ data: { blockerUserId: fanId, blockedUserId: ownerId } })
    expect((await post()).statusCode).toBe(404)
  })

  it('hides a suspended artist’s track from the player details and refuses reactions', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { suspendedAt: new Date() } })
    const details = await app.inject({ method: 'GET', url: `/api/reactions/track/${soundId}` })
    expect(details.statusCode).toBe(404)
    expect((await post()).statusCode).toBe(404)
  })
})
