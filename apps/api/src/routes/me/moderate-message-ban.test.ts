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

const PREFIX = 'moderate-message-ban-'

describe('banning the sender of a chat message', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let modCookie: string
  let outsiderCookie: string
  let slug: string
  let channelId: string
  let otherChannelId: string

  const post = (text: string, sub: string, meta: Record<string, unknown> = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: sub,
        meta: { userId: 'a-signed-in-sender', channelId, ...meta },
        data: { text },
      },
    })
  const messageId = async (text: string) =>
    (await prisma.chatMessage.findFirstOrThrow({ where: { channelId, text } })).id
  const ban = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/moderate/${slug}/chat/messages/${id}/ban`,
      headers: { cookie },
    })
  const bans = async () =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/me/moderate/${slug}/chat/bans`,
        headers: { cookie: ownerCookie },
      })
    ).json() as Array<{ id: string; handle: string | null; fingerprintHash: string }>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-msg-ban-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98520,
    })
    const moderator = await createTestArtist(prisma, {
      email: `${PREFIX}mod@example.com`,
      username: 'moderate-msg-ban-mod',
      memberNumber: 98521,
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: 'moderate-msg-ban-outsider',
      memberNumber: 98522,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    otherChannelId = outsider.channel!.id
    await prisma.channelModerator.create({ data: { channelId, userId: moderator.id } })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    modCookie = await sessionCookieFor(prisma, moderator.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('a moderator bans the sender, who can then no longer post', async () => {
    await post('spam spam spam', 'Spammer#1111222233334444')
    const id = await messageId('spam spam spam')

    expect((await ban(id, outsiderCookie)).statusCode).toBe(404)
    const res = await ban(id, modCookie)
    expect(res.statusCode).toBe(201)

    const refused = await post('more spam', 'Spammer#1111222233334444')
    expect(refused.json()).toEqual({ error: { code: 403, message: 'banned' } })

    const list = await bans()
    expect(list).toEqual([
      expect.objectContaining({ handle: 'Spammer', fingerprintHash: '1111222233334444' }),
    ])
  })

  it('banning the same sender twice keeps one ban under their latest name', async () => {
    await prisma.chatMessage.create({
      data: {
        channelId,
        handle: 'Spammer Renamed',
        text: 'an older message under another name',
        fingerprintHash: '1111222233334444',
      },
    })
    const id = await messageId('an older message under another name')
    expect((await ban(id, ownerCookie)).statusCode).toBe(201)
    expect(await bans()).toEqual([expect.objectContaining({ handle: 'Spammer Renamed' })])
  })

  it('refuses a message of the owner or a moderator, and one with no fingerprint', async () => {
    await post('hello from the artist', 'The Artist#aaaabbbbccccdddd', { channelRole: 'owner' })
    const staff = await ban(await messageId('hello from the artist'), modCookie)
    expect(staff.statusCode).toBe(400)

    await prisma.chatMessage.create({
      data: { channelId, handle: 'Old Timer', text: 'from before fingerprints' },
    })
    const old = await ban(await messageId('from before fingerprints'), modCookie)
    expect(old.statusCode).toBe(400)
    expect(await bans()).toHaveLength(1)
  })

  it('does not reach a message of another channel', async () => {
    const elsewhere = await prisma.chatMessage.create({
      data: {
        channelId: otherChannelId,
        handle: 'Someone',
        text: 'said in another room',
        fingerprintHash: '9999888877776666',
      },
    })
    expect((await ban(elsewhere.id, ownerCookie)).statusCode).toBe(404)
  })

  it('lifts a ban by its id, also one that the fingerprint route cannot address', async () => {
    const fanBan = await prisma.chatBan.create({
      data: { channelId, fingerprintHash: 'fan-12345678', handle: 'A Fan' },
    })
    const byHash = await app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/ban/fan-12345678`,
      headers: { cookie: modCookie },
    })
    expect(byHash.statusCode).toBe(400)

    const outsider = await app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/bans/${fanBan.id}`,
      headers: { cookie: outsiderCookie },
    })
    expect(outsider.statusCode).toBe(404)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/bans/${fanBan.id}`,
      headers: { cookie: modCookie },
    })
    expect(res.statusCode).toBe(204)
    expect((await bans()).map((b) => b.handle)).toEqual(['Spammer Renamed'])
  })
})
