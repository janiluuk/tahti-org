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

const PREFIX = 'moderate-messages-'

describe('GET /api/me/moderate/:slug/chat/messages', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let modCookie: string
  let outsiderCookie: string
  let slug: string
  let channelId: string

  const list = (cookie: string) =>
    app.inject({
      method: 'GET',
      url: `/api/me/moderate/${slug}/chat/messages`,
      headers: { cookie },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-messages-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98510,
    })
    const moderator = await createTestArtist(prisma, {
      email: `${PREFIX}mod@example.com`,
      username: 'moderate-messages-mod',
      memberNumber: 98511,
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: 'moderate-messages-outsider',
      memberNumber: 98512,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    await prisma.channelModerator.create({ data: { channelId, userId: moderator.id } })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    modCookie = await sessionCookieFor(prisma, moderator.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is closed to signed-out visitors and to accounts that do not run the room', async () => {
    const anonymous = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${slug}/chat/messages`,
    })
    expect(anonymous.statusCode).toBe(401)
    expect((await list(outsiderCookie)).statusCode).toBe(404)
  })

  it('keeps the fingerprint of a posted message and lists it without the fingerprint', async () => {
    const posted = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'Loud Visitor#abcdef0123456789',
        meta: { userId: 'someone-signed-in', channelId },
        data: { text: 'first message' },
      },
    })
    expect(posted.json()).toMatchObject({ result: { data: { text: 'first message' } } })

    const row = await prisma.chatMessage.findFirstOrThrow({
      where: { channelId, text: 'first message' },
    })
    expect(row.fingerprintHash).toBe('abcdef0123456789')

    const res = await list(modCookie)
    expect(res.statusCode).toBe(200)
    const message = res.json().messages.find((m: { id: string }) => m.id === row.id)
    expect(message).toMatchObject({
      handle: 'Loud Visitor',
      text: 'first message',
      fanOnly: false,
      channelRole: null,
      canBan: true,
      banned: false,
    })
    expect(JSON.stringify(res.json())).not.toContain('abcdef0123456789')
  })

  it('lists newest first, with the fan room, and marks banned senders', async () => {
    const at = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000)
    await prisma.chatMessage.createMany({
      data: [
        {
          channelId,
          handle: 'Old Timer',
          text: 'sent before fingerprints were kept',
          createdAt: at(300),
        },
        {
          channelId,
          handle: 'Spammer',
          text: 'buy my followers',
          fingerprintHash: 'feedfacefeedface',
          createdAt: at(200),
        },
        {
          channelId,
          handle: 'The Artist',
          text: 'welcome everyone',
          channelRole: 'owner',
          fingerprintHash: '0123456789abcdef',
          createdAt: at(100),
        },
        {
          channelId,
          handle: 'A Fan',
          text: 'in the fan room',
          fanOnly: true,
          fingerprintHash: 'fan-12345678',
          createdAt: at(50),
        },
      ],
    })
    await prisma.chatBan.create({ data: { channelId, fingerprintHash: 'feedfacefeedface' } })

    const messages: Array<Record<string, unknown>> = (await list(ownerCookie)).json().messages
    const texts = messages.map((m) => m.text)
    expect(texts.indexOf('in the fan room')).toBeLessThan(texts.indexOf('welcome everyone'))
    expect(texts.indexOf('welcome everyone')).toBeLessThan(texts.indexOf('buy my followers'))

    const byText = (text: string) => messages.find((m) => m.text === text)
    expect(byText('sent before fingerprints were kept')).toMatchObject({
      canBan: false,
      banned: false,
    })
    expect(byText('buy my followers')).toMatchObject({ canBan: true, banned: true })
    expect(byText('welcome everyone')).toMatchObject({ channelRole: 'owner', canBan: false })
    expect(byText('in the fan room')).toMatchObject({ fanOnly: true, canBan: true })
  })
})
