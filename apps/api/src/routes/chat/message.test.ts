// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-message-'

// Redis is absent in tests, which makes the real check report every
// fingerprint as verified.
const captcha = vi.hoisted(() => ({ verified: true }))
vi.mock('../../lib/chat-captcha.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/chat-captcha.js')>()),
  isChatCaptchaVerified: async () => captcha.verified,
}))

function refusal(message: string, code = 403) {
  return { error: { code, message } }
}

describe('POST /api/chat/message — Centrifugo proxy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let artistId: string
  let fanId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    slug = 'chat-message-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98395,
    })
    artistId = artist.id
    await prisma.fanTier.create({
      data: { artistUserId: artist.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash: 'x',
        username: 'chat-message-fan',
        displayName: 'Fan',
      },
    })
    fanId = fan.id
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
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

  it('accepts publish proxy without fingerprint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: `channel:${slug}`, data: { text: 'hello chat' } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ result: { data: { text: 'hello chat', handle: 'anon' } } })
  })

  it('persists the message to ChatMessage', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'Listener42#persisted-fingerprint',
        meta: { countryCode: 'FI' },
        data: { text: 'a message worth keeping', handle: 'Listener42' },
      },
    })
    expect(res.statusCode).toBe(200)

    const row = await prisma.chatMessage.findFirst({
      where: { channelId: channel.id, text: 'a message worth keeping' },
    })
    expect(row).not.toBeNull()
    expect(row?.handle).toBe('Listener42')
    expect(row?.countryCode).toBe('FI')
    expect(row?.fanOnly).toBe(false)
  })

  it('takes the handle and badges from the token, not from the message', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'Plain Listener#spoof-fingerprint',
        meta: { channelId: channel.id, supporter: false, channelRole: null, countryCode: 'SE' },
        data: {
          text: 'trust me, I run this channel',
          handle: slug,
          ts: 1700000000000,
          supporter: true,
          channelRole: 'owner',
          countryCode: 'FI',
          system: true,
        },
      },
    })

    expect(res.json()).toEqual({
      result: {
        data: {
          text: 'trust me, I run this channel',
          handle: 'Plain Listener',
          ts: 1700000000000,
          countryCode: 'SE',
        },
      },
    })
    const row = await prisma.chatMessage.findFirstOrThrow({
      where: { channelId: channel.id, text: 'trust me, I run this channel' },
    })
    expect(row).toMatchObject({
      handle: 'Plain Listener',
      supporter: false,
      channelRole: null,
      countryCode: 'SE',
    })
  })

  it('keeps the badges the token carries', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'The Artist#owner-fingerprint',
        meta: { userId: artistId, channelId: channel.id, supporter: true, channelRole: 'owner' },
        data: { text: 'hello from the booth', handle: 'The Artist' },
      },
    })

    expect(res.json()).toEqual({
      result: {
        data: {
          text: 'hello from the booth',
          handle: 'The Artist',
          supporter: true,
          channelRole: 'owner',
        },
      },
    })
  })

  it('reads the fingerprint after the last # so a handle with a # stays banned', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    await prisma.chatBan.create({
      data: { channelId: channel.id, fingerprintHash: 'banned-fingerprint' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'dodge#1#banned-fingerprint',
        meta: { userId: fanId },
        data: { text: 'still here' },
      },
    })
    expect(res.json()).toEqual(refusal('banned'))
  })

  it('marks messages on the :fans sub-channel as fanOnly', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}:fans`,
        meta: { userId: fanId },
        data: { text: 'fans-only note' },
      },
    })

    const row = await prisma.chatMessage.findFirst({
      where: { channelId: channel.id, text: 'fans-only note' },
    })
    expect(row?.fanOnly).toBe(true)
  })

  it('lets the artist post in their own fan room', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}:fans`,
        meta: { userId: artistId },
        data: { text: 'thanks for subscribing' },
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('refuses fan-room posts from anonymous and non-subscribed senders', async () => {
    const stranger = await prisma.user.create({
      data: {
        email: `${PREFIX}stranger@example.com`,
        passwordHash: 'x',
        username: 'chat-message-stranger',
        displayName: 'Stranger',
      },
    })
    for (const meta of [undefined, { userId: stranger.id }]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/message',
        payload: {
          channel: `channel:${slug}:fans`,
          ...(meta ? { meta } : {}),
          data: { text: 'sneaking into the fan room' },
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(refusal('fan_chat_required'))
    }
    const leaked = await prisma.chatMessage.count({
      where: { text: 'sneaking into the fan room' },
    })
    expect(leaked).toBe(0)
  })

  it('refuses an unknown channel with a Centrifugo proxy error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: 'channel:missing-slug', data: { text: 'hello' } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(refusal('channel not found', 404))
  })

  it('rejects messages over 500 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: `channel:${slug}`, data: { text: 'x'.repeat(501) } },
    })
    expect(res.statusCode).toBe(400)
  })

  it('SEC-007: rejects requests from outside the internal network', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      remoteAddress: '203.0.113.50',
      payload: { channel: `channel:${slug}`, data: { text: 'hello chat' } },
    })
    expect(res.statusCode).toBe(403)
  })

  it('asks an anonymous sender with no verified captcha to solve it again', async () => {
    captcha.verified = false
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/message',
        payload: {
          channel: `channel:${slug}`,
          user: 'AnonListener#never-verified-fingerprint',
          data: { text: 'anonymous, no captcha' },
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(refusal('captcha_required'))
      const stored = await prisma.chatMessage.count({ where: { text: 'anonymous, no captcha' } })
      expect(stored).toBe(0)
    } finally {
      captcha.verified = true
    }
  })

  it('accepts an unverified fingerprint when meta.userId is present (signed-in sender)', async () => {
    const sender = await createTestArtist(prisma, {
      email: `${PREFIX}signed-in@example.com`,
      username: 'chat-message-signed-in',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98399,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: 'SignedInListener#never-verified-fingerprint-2',
        meta: { userId: sender.id },
        data: { text: 'signed in, no captcha needed' },
      },
    })
    expect(res.statusCode).toBe(200)

    const row = await prisma.chatMessage.findFirst({
      where: {
        channelId: (await prisma.channel.findUniqueOrThrow({ where: { slug } })).id,
        text: 'signed in, no captcha needed',
      },
    })
    expect(row).not.toBeNull()
  })

  it('still enforces bans for signed-in senders even though captcha is skipped', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const sender = await createTestArtist(prisma, {
      email: `${PREFIX}banned-signed-in@example.com`,
      username: 'chat-message-banned-signed-in',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98400,
    })
    const fingerprintHash = 'banned-signed-in-fingerprint'
    await prisma.chatBan.create({
      data: { channelId: channel.id, fingerprintHash },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        user: `BannedListener#${fingerprintHash}`,
        meta: { userId: sender.id },
        data: { text: 'should not post' },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(refusal('banned'))
  })

  it('records CHAT mentions and notifies when meta.userId is present', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}from@example.com`,
      username: 'chat-message-from',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98396,
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}to@example.com`,
      username: 'chat-message-to',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98397,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        meta: { userId: mentioner.id },
        data: { text: `hey @${target.username} nice set` },
      },
    })
    expect(res.statusCode).toBe(200)

    const mention = await prisma.mention.findFirst({
      where: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'CHAT',
      },
    })
    expect(mention).not.toBeNull()

    const note = await prisma.notification.findFirst({
      where: {
        userId: target.id,
        type: 'CHAT_MENTION',
        actorUserId: mentioner.id,
      },
    })
    expect(note).not.toBeNull()
    expect(note?.url).toBe(`/c/${slug}`)
  })

  it('skips mention notifications when meta.userId is absent', async () => {
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}anon-to@example.com`,
      username: 'chat-message-anon-to',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98398,
    })
    const before = await prisma.mention.count({
      where: { targetUserId: target.id, surface: 'CHAT' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        data: { text: `hey @${target.username}` },
      },
    })
    expect(res.statusCode).toBe(200)

    const after = await prisma.mention.count({
      where: { targetUserId: target.id, surface: 'CHAT' },
    })
    expect(after).toBe(before)
  })

  it('refuses posts with chat_disabled once the owner has switched chat off', async () => {
    await prisma.user.update({ where: { id: artistId }, data: { chatEnabled: false } })
    try {
      for (const payload of [
        { channel: `channel:${slug}`, data: { text: 'still here?' } },
        { channel: `channel:${slug}`, meta: { userId: artistId }, data: { text: 'owner post' } },
        { channel: `channel:${slug}:fans`, meta: { userId: fanId }, data: { text: 'fan post' } },
      ]) {
        const res = await app.inject({ method: 'POST', url: '/api/chat/message', payload })
        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual(refusal('chat_disabled'))
      }
      const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
      const stored = await prisma.chatMessage.count({
        where: { channelId: channel.id, text: { in: ['still here?', 'owner post', 'fan post'] } },
      })
      expect(stored).toBe(0)
    } finally {
      await prisma.user.update({ where: { id: artistId }, data: { chatEnabled: true } })
    }
  })

  it('refuses posts across a block with the channel owner, in either direction', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const [blockedByOwner, blockedOwner, bystander] = await Promise.all(
      ['blocked', 'blocker', 'bystander'].map((name) =>
        prisma.user.create({
          data: {
            email: `${PREFIX}chat-${name}@example.com`,
            passwordHash: 'x',
            username: `chat-message-${name}`,
            displayName: name,
          },
        }),
      ),
    )
    await prisma.userBlock.createMany({
      data: [
        { blockerUserId: artistId, blockedUserId: blockedByOwner!.id },
        { blockerUserId: blockedOwner!.id, blockedUserId: artistId },
      ],
    })
    const post = (userId: string, text: string) =>
      app.inject({
        method: 'POST',
        url: '/api/chat/message',
        payload: { channel: `channel:${slug}`, meta: { userId }, data: { text } },
      })

    for (const sender of [blockedByOwner!, blockedOwner!]) {
      const res = await post(sender.id, 'across the block')
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(refusal('banned'))
    }
    for (const [userId, text] of [
      [bystander!.id, 'hello from a bystander'],
      [artistId, 'hello from the owner'],
    ] as const) {
      expect((await post(userId, text)).json()).toEqual({
        result: { data: { text, handle: 'anon' } },
      })
    }

    const stored = await prisma.chatMessage.findMany({
      where: { channelId: channel.id, userId: { in: [blockedByOwner!.id, blockedOwner!.id] } },
    })
    expect(stored).toEqual([])

    await prisma.userBlock.deleteMany({ where: { blockerUserId: artistId } })
    expect((await post(blockedByOwner!.id, 'unblocked')).json()).toEqual({
      result: { data: { text: 'unblocked', handle: 'anon' } },
    })
  })
})
