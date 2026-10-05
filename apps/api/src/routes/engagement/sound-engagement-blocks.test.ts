// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-engage-block-'

describe('loves and reposts across a block', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let fanId: string
  let fanCookie: string
  let ownerCookie: string
  let ownerTrack: string
  let fanTrack: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const makeArtist = async (name: string) => {
      const artist = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      const sound = await prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title: `${name} track`,
          status: 'READY',
          isPublic: true,
        },
      })
      return {
        id: artist.id,
        cookie: await sessionCookieFor(prisma, artist.id),
        path: `/api/v1/c/${artist.channel!.slug}/sounds/${sound.id}`,
      }
    }
    const owner = await makeArtist('owner')
    const fan = await makeArtist('fan')
    ownerId = owner.id
    ownerCookie = owner.cookie
    ownerTrack = owner.path
    fanId = fan.id
    fanCookie = fan.cookie
    fanTrack = fan.path

    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: fanId } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it.each(['like', 'repost'])('the blocked account cannot %s the blocker’s track', async (kind) => {
    const res = await app.inject({
      method: 'POST',
      url: `${ownerTrack}/${kind}`,
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(await prisma.soundLike.count({ where: { userId: fanId } })).toBe(0)
    expect(await prisma.soundRepost.count({ where: { userId: fanId } })).toBe(0)
    expect(await prisma.notification.count({ where: { userId: ownerId } })).toBe(0)
  })

  it.each(['like', 'repost'])('the blocker cannot %s the blocked account’s track', async (kind) => {
    const res = await app.inject({
      method: 'POST',
      url: `${fanTrack}/${kind}`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(await prisma.soundLike.count({ where: { userId: ownerId } })).toBe(0)
    expect(await prisma.soundRepost.count({ where: { userId: ownerId } })).toBe(0)
  })

  it('an earlier love can still be undone, and both work again after unblocking', async () => {
    const soundId = ownerTrack.split('/').pop()!
    await prisma.soundLike.create({ data: { userId: fanId, soundId } })

    const undo = await app.inject({
      method: 'DELETE',
      url: `${ownerTrack}/like`,
      headers: { cookie: fanCookie },
    })
    expect(undo.statusCode).toBe(200)
    expect(undo.json()).toEqual({ liked: false, likeCount: 0 })

    await prisma.userBlock.deleteMany({ where: { blockerUserId: ownerId } })
    for (const kind of ['like', 'repost']) {
      const res = await app.inject({
        method: 'POST',
        url: `${ownerTrack}/${kind}`,
        headers: { cookie: fanCookie },
      })
      expect(res.statusCode).toBe(200)
    }
  })
})
