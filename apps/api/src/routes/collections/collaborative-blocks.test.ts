// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'col-collab-blocks-'

describe('collaborative playlists and blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let guestId: string
  let subscriberId: string
  let guestCookie: string
  let channelId: string
  let collectionId: string
  const slug = `${PREFIX}open`

  const add = async (title: string) => {
    const sound = await prisma.sound.create({
      data: { channelId, title, status: 'READY', isPublic: true },
    })
    return app.inject({
      method: 'POST',
      url: `/api/v1/collections/${slug}/items`,
      headers: { cookie: guestCookie },
      payload: { soundId: sound.id },
    })
  }

  const noticesFor = (userId: string) =>
    prisma.notification.count({ where: { userId, type: 'PLAYLIST_TRACK_ADDED' } })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const [owner, guest, subscriber] = await Promise.all(
      ['owner', 'guest', 'subscriber'].map((name) =>
        createTestArtist(prisma, {
          email: `${PREFIX}${name}@example.com`,
          username: `${PREFIX}${name}`,
        }),
      ),
    )
    ownerId = owner!.id
    guestId = guest!.id
    subscriberId = subscriber!.id
    channelId = guest!.channel!.id
    guestCookie = await sessionCookieFor(prisma, guestId)
    const col = await prisma.collection.create({
      data: { userId: ownerId, slug, name: 'Open', isPublic: true, collaborative: true },
    })
    collectionId = col.id
    await prisma.collectionSubscription.create({
      data: { userId: subscriberId, collectionId },
    })
  })

  afterEach(async () => {
    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockerUserId: ownerId },
          { blockerUserId: guestId },
          { blockerUserId: subscriberId },
        ],
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('takes a track from a guest when nobody is blocked', async () => {
    const res = await add('Welcome')
    expect(res.statusCode).toBe(201)
  })

  it('refuses a guest the owner blocked, as if the playlist were missing', async () => {
    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: guestId } })
    const before = await prisma.collectionItem.count({ where: { collectionId } })

    const res = await add('Unwanted')

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Collection not found' })
    expect(await prisma.collectionItem.count({ where: { collectionId } })).toBe(before)
  })

  it('refuses a guest who blocked the owner', async () => {
    await prisma.userBlock.create({ data: { blockerUserId: guestId, blockedUserId: ownerId } })
    expect((await add('From a blocker')).statusCode).toBe(404)
  })

  it('does not tell a subscriber who blocked the guest', async () => {
    await prisma.userBlock.create({
      data: { blockerUserId: subscriberId, blockedUserId: guestId },
    })
    const [ownerBefore, subscriberBefore] = await Promise.all([
      noticesFor(ownerId),
      noticesFor(subscriberId),
    ])

    expect((await add('Quiet for one')).statusCode).toBe(201)

    expect(await noticesFor(ownerId)).toBe(ownerBefore + 1)
    expect(await noticesFor(subscriberId)).toBe(subscriberBefore)
  })
})
