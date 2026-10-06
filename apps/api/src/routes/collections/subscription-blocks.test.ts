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

const PREFIX = 'col-sub-blocks-'

describe('collection subscriptions and account blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let ownerCookie: string
  let fanId: string
  let fanCookie: string
  let collectionId: string
  const slug = `${PREFIX}mix`

  const subscribe = (cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/collections/${slug}/subscribe`,
      headers: { cookie },
    })
  const listed = async () =>
    (
      (
        await app.inject({
          method: 'GET',
          url: '/api/me/collection-subscriptions',
          headers: { cookie: fanCookie },
        })
      ).json().items as Array<{ slug: string }>
    ).map((i) => i.slug)

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
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    fanCookie = await sessionCookieFor(prisma, fan.id)
    const collection = await prisma.collection.create({
      data: { userId: ownerId, slug, name: 'Mix', isPublic: true },
    })
    collectionId = collection.id
  })

  afterEach(async () => {
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerUserId: ownerId }, { blockerUserId: fanId }] },
    })
    await prisma.collectionSubscription.deleteMany({ where: { collectionId } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses a new subscription across a block in either direction', async () => {
    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: fanId } })
    expect((await subscribe(fanCookie)).statusCode).toBe(404)
    await prisma.userBlock.deleteMany({ where: { blockerUserId: ownerId } })

    await prisma.userBlock.create({ data: { blockerUserId: fanId, blockedUserId: ownerId } })
    expect((await subscribe(fanCookie)).statusCode).toBe(404)
    expect(await prisma.collectionSubscription.count({ where: { collectionId } })).toBe(0)
  })

  it('still lets the owner and unblocked accounts subscribe', async () => {
    expect((await subscribe(ownerCookie)).statusCode).toBe(200)
    expect((await subscribe(fanCookie)).statusCode).toBe(200)
  })

  it('leaves a blocked owner out of the subscriptions list and brings it back on unblock', async () => {
    await subscribe(fanCookie)
    expect(await listed()).toEqual([slug])

    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: fanId } })
    expect(await listed()).toEqual([])
    await prisma.userBlock.deleteMany({ where: { blockerUserId: ownerId } })

    await prisma.userBlock.create({ data: { blockerUserId: fanId, blockedUserId: ownerId } })
    expect(await listed()).toEqual([])
    await prisma.userBlock.deleteMany({ where: { blockerUserId: fanId } })
    expect(await listed()).toEqual([slug])
  })
})
