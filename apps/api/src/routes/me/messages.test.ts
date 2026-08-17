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

const PREFIX = 'dm-test-'

describe('M38 — private messaging', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookieA: string
  let cookieB: string
  let cookieC: string
  let userA: { id: string; username: string }
  let userB: { id: string; username: string }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const a = await createTestArtist(prisma, {
      email: `${PREFIX}a@example.com`,
      username: 'dm-test-alex',
    })
    const b = await createTestArtist(prisma, {
      email: `${PREFIX}b@example.com`,
      username: 'dm-test-blair',
    })
    const c = await createTestArtist(prisma, {
      email: `${PREFIX}c@example.com`,
      username: 'dm-test-casey',
    })
    userA = { id: a.id, username: 'dm-test-alex' }
    userB = { id: b.id, username: 'dm-test-blair' }
    cookieA = await sessionCookieFor(prisma, a.id)
    cookieB = await sessionCookieFor(prisma, b.id)
    cookieC = await sessionCookieFor(prisma, c.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/users/search finds users by username/display name, excluding self', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=dm-test-bl',
      headers: { cookie: cookieA },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ username: string }>
    expect(body.some((u) => u.username === userB.username)).toBe(true)
    expect(body.some((u) => u.username === userA.username)).toBe(false)
  })

  it('lists followers and followed artists once as message contacts', async () => {
    await prisma.artistFollow.createMany({
      data: [
        { followerUserId: userA.id, artistUserId: userB.id },
        { followerUserId: userB.id, artistUserId: userA.id },
      ],
      skipDuplicates: true,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/messages/contacts',
      headers: { cookie: cookieA },
    })
    expect(res.statusCode).toBe(200)
    const contacts = res.json() as Array<{
      username: string
      followsYou: boolean
      followedByYou: boolean
    }>
    expect(contacts.filter((contact) => contact.username === userB.username)).toHaveLength(1)
    expect(contacts.find((contact) => contact.username === userB.username)).toMatchObject({
      followsYou: true,
      followedByYou: true,
    })
  })

  it('rejects starting a conversation with yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieA },
      payload: { username: userA.username },
    })
    expect(res.statusCode).toBe(400)
  })

  let conversationId: string

  it('starts a conversation and reuses it on a repeat request', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieA },
      payload: { username: userB.username },
    })
    expect(first.statusCode).toBe(200)
    conversationId = first.json().conversationId

    const second = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieA },
      payload: { username: userB.username },
    })
    expect(second.json().conversationId).toBe(conversationId)

    // Also reused from the other side (B -> A resolves to the same conversation).
    const fromB = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieB },
      payload: { username: userA.username },
    })
    expect(fromB.json().conversationId).toBe(conversationId)
  })

  it('sends messages and both sides see them in order', async () => {
    const m1 = await app.inject({
      method: 'POST',
      url: `/api/me/messages/conversations/${conversationId}/messages`,
      headers: { cookie: cookieA },
      payload: { body: 'Hey Blair! 👋' },
    })
    expect(m1.statusCode).toBe(201)
    expect(m1.json().isMine).toBe(true)
    expect(m1.json().body).toBe('Hey Blair! 👋')

    const m2 = await app.inject({
      method: 'POST',
      url: `/api/me/messages/conversations/${conversationId}/messages`,
      headers: { cookie: cookieB },
      payload: { body: 'Hey Alex 🎧' },
    })
    expect(m2.statusCode).toBe(201)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/me/messages/conversations/${conversationId}`,
      headers: { cookie: cookieA },
    })
    expect(detail.statusCode).toBe(200)
    const body = detail.json() as {
      otherUser: { username: string }
      messages: Array<{ body: string; isMine: boolean; senderUsername: string }>
    }
    expect(body.otherUser.username).toBe(userB.username)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0]!.body).toBe('Hey Blair! 👋')
    expect(body.messages[0]!.isMine).toBe(true)
    expect(body.messages[1]!.isMine).toBe(false)
    expect(body.messages[1]!.senderUsername).toBe(userB.username)
  })

  it('rejects sending into a conversation the caller is not part of', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/messages/conversations/${conversationId}/messages`,
      headers: { cookie: cookieC },
      payload: { body: 'sneaky' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects reading a conversation the caller is not part of', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/messages/conversations/${conversationId}`,
      headers: { cookie: cookieC },
    })
    expect(res.statusCode).toBe(404)
  })

  it('notifies the recipient and clears their unread count once they view the thread', async () => {
    const notif = await prisma.notification.findFirst({
      where: { userId: userB.id, type: 'NEW_MESSAGE' },
      orderBy: { createdAt: 'desc' },
    })
    expect(notif).toBeTruthy()
    expect(notif?.url).toBe(`/dashboard/messages/${conversationId}`)

    // Blair sent a message of their own but never GET'd the thread, so Alex's
    // "Hey Blair! 👋" is still unread on Blair's side.
    const listBefore = await app.inject({
      method: 'GET',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieB },
    })
    const convoForB = (listBefore.json() as Array<{ id: string; unreadCount: number }>).find(
      (c) => c.id === conversationId,
    )
    expect(convoForB?.unreadCount).toBe(1)

    await app.inject({
      method: 'GET',
      url: `/api/me/messages/conversations/${conversationId}`,
      headers: { cookie: cookieB },
    })

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieB },
    })
    const convoForBAfter = (listAfter.json() as Array<{ id: string; unreadCount: number }>).find(
      (c) => c.id === conversationId,
    )
    expect(convoForBAfter?.unreadCount).toBe(0)
  })

  it('requires auth on every messaging route', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/me/messages/conversations' })
    expect(list.statusCode).toBe(401)
    const contacts = await app.inject({ method: 'GET', url: '/api/me/messages/contacts' })
    expect(contacts.statusCode).toBe(401)
    const search = await app.inject({ method: 'GET', url: '/api/users/search?q=x' })
    expect(search.statusCode).toBe(401)
  })
})
