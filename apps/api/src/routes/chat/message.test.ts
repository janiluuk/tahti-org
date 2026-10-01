// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-message-'

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
    expect(res.json()).toEqual({ result: {} })
  })

  it('persists the message to ChatMessage', async () => {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: {
        channel: `channel:${slug}`,
        data: { text: 'a message worth keeping', handle: 'Listener42', countryCode: 'FI' },
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
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ error: 'fan_chat_required' })
    }
    const leaked = await prisma.chatMessage.count({
      where: { text: 'sneaking into the fan room' },
    })
    expect(leaked).toBe(0)
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/message',
      payload: { channel: 'channel:missing-slug', data: { text: 'hello' } },
    })
    expect(res.statusCode).toBe(404)
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

  // Note: isChatCaptchaVerified fails *open* (treats an unreachable Redis as
  // "verified") whenever the caller doesn't pass `failOpen: false`, and
  // getRedisClient() always returns null in the test env (see redis.ts) — so
  // the anonymous-and-never-verified 403 path isn't reachable from an
  // integration test against this route. This suite only covers the new
  // signed-in bypass, which doesn't depend on Redis at all.

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
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'banned' })
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
})
