// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'chat-react-banned-'

describe('POST /api/chat/:slug/react for banned and blocked senders', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let channelId: string
  let ownerId: string
  let ownerCookie: string
  let listenerId: string
  let listenerCookie: string
  const published: string[] = []

  // Each request gets its own user agent: the route allows three reactions
  // per address and browser in five seconds.
  const react = (userAgent: string, cookie?: string) =>
    app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/react`,
      headers: { 'user-agent': userAgent, ...(cookie ? { cookie } : {}) },
      payload: { emoji: '🔥' },
    })
  const fingerprintOf = (userAgent: string) =>
    createHash('sha256')
      .update(`127.0.0.1:${userAgent}:${channelId}:${process.env.FINGERPRINT_SALT ?? 'dev-salt'}`)
      .digest('hex')
      .slice(0, 16)

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'chat-react-banned-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98550,
    })
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: 'chat-react-banned-listener',
      memberNumber: 98551,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    ownerId = owner.id
    listenerId = listener.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    listenerCookie = await sessionCookieFor(prisma, listener.id)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: string }) => {
        published.push(String(init?.body ?? ''))
        return new Response('{}', { status: 200 })
      }),
    )
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('a banned fingerprint cannot send reactions, and nothing is published', async () => {
    expect((await react('banned-browser')).statusCode).toBe(200)
    await prisma.chatBan.create({
      data: { channelId, fingerprintHash: fingerprintOf('banned-browser') },
    })
    const before = published.length

    const res = await react('banned-browser')
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'banned' })
    expect(published.length).toBe(before)

    expect((await react('someone-else')).statusCode).toBe(200)
    expect(published.length).toBe(before + 1)
  })

  it('a ban on another channel does not carry over', async () => {
    const other = await prisma.channel.findFirstOrThrow({ where: { userId: listenerId } })
    await prisma.chatBan.create({
      data: { channelId: other.id, fingerprintHash: fingerprintOf('roaming-browser') },
    })
    expect((await react('roaming-browser')).statusCode).toBe(200)
  })

  it('an account blocked by the owner, or blocking them, cannot react; the owner can', async () => {
    expect((await react('listener-browser-1', listenerCookie)).statusCode).toBe(200)

    await prisma.userBlock.create({ data: { blockerUserId: ownerId, blockedUserId: listenerId } })
    const before = published.length
    const blocked = await react('listener-browser-2', listenerCookie)
    expect(blocked.statusCode).toBe(403)
    expect(published.length).toBe(before)

    await prisma.userBlock.deleteMany({ where: { blockerUserId: ownerId } })
    await prisma.userBlock.create({ data: { blockerUserId: listenerId, blockedUserId: ownerId } })
    expect((await react('listener-browser-3', listenerCookie)).statusCode).toBe(403)

    expect((await react('owner-browser', ownerCookie)).statusCode).toBe(200)
  })
})
