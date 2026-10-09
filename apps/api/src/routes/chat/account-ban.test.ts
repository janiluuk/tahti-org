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

const PREFIX = 'chat-account-ban-'

describe('a chat ban on a signed-in sender follows the account', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let listenerCookie: string
  let listenerId: string
  let ownerId: string
  let slug: string
  let channelId: string

  const publish = (text: string, sub: string, userId: string | null, fans = false) =>
    app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}${fans ? ':fans' : ''}`,
        user: sub,
        meta: { ...(userId ? { userId } : {}), channelId },
        data: { text },
      },
    })
  const token = (cookie: string, userAgent: string) =>
    app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/token`,
      headers: { cookie, 'content-type': 'application/json', 'user-agent': userAgent },
      payload: { handle: 'Listener' },
    })
  const banned = { error: { code: 403, message: 'banned' } }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'chat-account-ban-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98540,
    })
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: 'chat-account-ban-listener',
      memberNumber: 98541,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    ownerId = owner.id
    listenerId = listener.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    listenerCookie = await sessionCookieFor(prisma, listener.id)

    await prisma.fanTier.create({
      data: { artistUserId: owner.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    await prisma.fanSubscription.create({
      data: {
        subscriberUserId: listener.id,
        artistUserId: owner.id,
        amountCents: 500,
        tierName: 'Supporter',
        stripeSubscriptionId: `sub_${PREFIX}`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('before the ban the listener can join and post', async () => {
    expect((await token(listenerCookie, 'browser-one')).statusCode).toBe(200)
    const res = await publish('hello there', 'Listener#aaaa000011112222', listenerId)
    expect(res.json()).toMatchObject({ result: { data: { text: 'hello there' } } })
  })

  it('a ban set on their message names the account', async () => {
    const message = await prisma.chatMessage.findFirstOrThrow({
      where: { channelId, text: 'hello there' },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/moderate/${slug}/chat/messages/${message.id}/ban`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(201)
    const ban = await prisma.chatBan.findFirstOrThrow({ where: { channelId } })
    expect(ban.userId).toBe(listenerId)
  })

  it('holds under a new fingerprint: no token, no post, no fan room', async () => {
    const joined = await token(listenerCookie, 'a-different-browser')
    expect(joined.statusCode).toBe(403)
    expect(joined.json()).toEqual({ error: 'banned' })

    const posted = await publish('back again', 'Listener#ffff999988887777', listenerId)
    expect(posted.json()).toEqual(banned)

    const fanToken = await app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/fan-token`,
      headers: { cookie: listenerCookie },
    })
    expect(fanToken.statusCode).toBe(403)
    expect(fanToken.json()).toEqual({ error: 'banned' })

    const fanPost = await publish(
      'back in the fan room',
      `Listener#fan-${listenerId.slice(0, 8)}`,
      listenerId,
      true,
    )
    expect(fanPost.json()).toEqual(banned)
  })

  it('does not touch a signed-out visitor or the owner', async () => {
    await prisma.chatBan.create({
      data: { channelId, fingerprintHash: 'owner-fingerprint-x', userId: ownerId },
    })
    const owner = await publish('still my room', 'The Artist#bbbb000011112222', ownerId)
    expect(owner.json()).toMatchObject({ result: { data: { text: 'still my room' } } })
  })

  it('lifting the ban lets the account back in', async () => {
    const ban = await prisma.chatBan.findFirstOrThrow({ where: { channelId, userId: listenerId } })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/bans/${ban.id}`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(204)
    expect((await token(listenerCookie, 'a-different-browser')).statusCode).toBe(200)
    const posted = await publish('thank you', 'Listener#ffff999988887777', listenerId)
    expect(posted.json()).toMatchObject({ result: { data: { text: 'thank you' } } })
  })
})
