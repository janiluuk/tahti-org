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

  it('keeps one unread notification per conversation, showing the latest message', async () => {
    const send = (body: string) =>
      app.inject({
        method: 'POST',
        url: `/api/me/messages/conversations/${conversationId}/messages`,
        headers: { cookie: cookieA, 'content-type': 'application/json' },
        payload: { body },
      })
    await prisma.notification.deleteMany({ where: { userId: userB.id, type: 'NEW_MESSAGE' } })
    await send('first line')
    await send('second line')
    await send('third line')
    const unread = await prisma.notification.findMany({
      where: { userId: userB.id, type: 'NEW_MESSAGE', readAt: null },
    })
    expect(unread).toHaveLength(1)
    expect(unread[0]?.body).toBe('third line')

    await prisma.notification.updateMany({
      where: { userId: userB.id, type: 'NEW_MESSAGE' },
      data: { readAt: new Date() },
    })
    await send('after reading')
    expect(
      await prisma.notification.count({ where: { userId: userB.id, type: 'NEW_MESSAGE' } }),
    ).toBe(2)
  })

  it('shows the newest 200 messages, oldest first, in a long thread', async () => {
    const userC = await prisma.user.findUniqueOrThrow({
      where: { username: 'dm-test-casey' },
      select: { id: true },
    })
    const start = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieA },
      payload: { username: 'dm-test-casey' },
    })
    const longThreadId = start.json().conversationId as string
    const base = Date.UTC(2026, 0, 1)
    await prisma.message.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        conversationId: longThreadId,
        senderId: i % 2 === 0 ? userA.id : userC.id,
        body: `message ${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/messages/conversations/${longThreadId}`,
      headers: { cookie: cookieA },
    })
    expect(res.statusCode).toBe(200)
    const bodies = (res.json() as { messages: Array<{ body: string }> }).messages.map((m) => m.body)
    expect(bodies).toHaveLength(200)
    expect(bodies[0]).toBe('message 5')
    expect(bodies[199]).toBe('message 204')
    expect(res.json().hasMore).toBe(true)
  })

  it('pages back through older messages with ?before=', async () => {
    const userC = await prisma.user.findUniqueOrThrow({
      where: { username: 'dm-test-casey' },
      select: { id: true },
    })
    const conversation = await prisma.conversation.create({
      data: { participants: { create: [{ userId: userB.id }, { userId: userC.id }] } },
      select: { id: true },
    })
    const base = Date.UTC(2026, 1, 1)
    await prisma.message.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        conversationId: conversation.id,
        senderId: i % 2 === 0 ? userB.id : userC.id,
        body: `page ${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    })
    const url = `/api/me/messages/conversations/${conversation.id}`
    type Page = { messages: Array<{ id: string; body: string }>; hasMore: boolean }

    const newest = await app.inject({
      method: 'GET',
      url: `${url}?limit=3`,
      headers: { cookie: cookieB },
    })
    expect(newest.statusCode).toBe(200)
    const first = newest.json() as Page
    expect(first.messages.map((m) => m.body)).toEqual(['page 4', 'page 5', 'page 6'])
    expect(first.hasMore).toBe(true)

    const older = await app.inject({
      method: 'GET',
      url: `${url}?limit=3&before=${first.messages[0]!.id}`,
      headers: { cookie: cookieB },
    })
    expect(older.statusCode).toBe(200)
    const second = older.json() as Page
    expect(second.messages.map((m) => m.body)).toEqual(['page 1', 'page 2', 'page 3'])
    expect(second.hasMore).toBe(true)

    const oldest = await app.inject({
      method: 'GET',
      url: `${url}?limit=3&before=${second.messages[0]!.id}`,
      headers: { cookie: cookieB },
    })
    expect((oldest.json() as Page).messages.map((m) => m.body)).toEqual(['page 0'])
    expect((oldest.json() as Page).hasMore).toBe(false)

    const byDate = await app.inject({
      method: 'GET',
      url: `${url}?limit=2&before=${new Date(base + 3000).toISOString()}`,
      headers: { cookie: cookieB },
    })
    expect((byDate.json() as Page).messages.map((m) => m.body)).toEqual(['page 1', 'page 2'])

    const invalid = await app.inject({
      method: 'GET',
      url: `${url}?before=not-a-message`,
      headers: { cookie: cookieB },
    })
    expect(invalid.statusCode).toBe(400)
  })

  it('only marks a conversation read when the newest page is viewed', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieB },
      payload: { username: 'dm-test-casey' },
    })
    const id = start.json().conversationId as string
    await app.inject({
      method: 'POST',
      url: `/api/me/messages/conversations/${id}/messages`,
      headers: { cookie: cookieC },
      payload: { body: 'unread for Blair' },
    })
    const unread = async () => {
      const list = await app.inject({
        method: 'GET',
        url: '/api/me/messages/conversations',
        headers: { cookie: cookieB },
      })
      return (list.json() as Array<{ id: string; unreadCount: number }>).find((c) => c.id === id)
        ?.unreadCount
    }

    expect(await unread()).toBe(1)
    await app.inject({
      method: 'GET',
      url: `/api/me/messages/conversations/${id}?before=${new Date().toISOString()}`,
      headers: { cookie: cookieB },
    })
    expect(await unread()).toBe(1)
  })

  describe('deleted and suspended accounts', () => {
    let suspended: { id: string; username: string }
    let deleted: { id: string; username: string }

    beforeAll(async () => {
      const s = await createTestArtist(prisma, {
        email: `${PREFIX}suspended@example.com`,
        username: 'dm-test-gone-suspended',
      })
      const d = await createTestArtist(prisma, {
        email: `${PREFIX}deleted@example.com`,
        username: 'dm-test-gone-deleted',
      })
      suspended = { id: s.id, username: 'dm-test-gone-suspended' }
      deleted = { id: d.id, username: 'dm-test-gone-deleted' }
    })

    it('leaves them out of user search', async () => {
      await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })
      await prisma.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })

      const res = await app.inject({
        method: 'GET',
        url: '/api/users/search?q=dm-test-gone',
        headers: { cookie: cookieA },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([])
    })

    it('refuses to start a conversation with them', async () => {
      for (const username of [suspended.username, deleted.username]) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/me/messages/conversations',
          headers: { cookie: cookieA },
          payload: { username },
        })
        expect(res.statusCode).toBe(403)
        expect(res.json()).toEqual({
          error: 'This account is no longer available',
          code: 'recipient_unavailable',
        })
      }
    })

    it('refuses to send into an existing conversation once the recipient is suspended', async () => {
      await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: null } })
      const start = await app.inject({
        method: 'POST',
        url: '/api/me/messages/conversations',
        headers: { cookie: cookieA },
        payload: { username: suspended.username },
      })
      expect(start.statusCode).toBe(200)
      const id = start.json().conversationId as string
      await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })

      const res = await app.inject({
        method: 'POST',
        url: `/api/me/messages/conversations/${id}/messages`,
        headers: { cookie: cookieA },
        payload: { body: 'Still there?' },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().code).toBe('recipient_unavailable')
      expect(await prisma.message.count({ where: { conversationId: id } })).toBe(0)
    })

    it('leaves them out of the contact list', async () => {
      await prisma.artistFollow.createMany({
        data: [
          { followerUserId: userA.id, artistUserId: suspended.id },
          { followerUserId: deleted.id, artistUserId: userA.id },
        ],
        skipDuplicates: true,
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/me/messages/contacts',
        headers: { cookie: cookieA },
      })
      expect(res.statusCode).toBe(200)
      const usernames = (res.json() as Array<{ username: string }>).map((c) => c.username)
      expect(usernames).toContain(userB.username)
      expect(usernames).not.toContain(suspended.username)
      expect(usernames).not.toContain(deleted.username)
    })

    it('keeps existing conversations in the inbox but marks them unavailable', async () => {
      const withDeleted = await prisma.conversation.create({
        data: { participants: { create: [{ userId: userA.id }, { userId: deleted.id }] } },
        select: { id: true },
      })
      await prisma.message.create({
        data: { conversationId: withDeleted.id, senderId: deleted.id, body: 'Bye for now' },
      })

      const list = await app.inject({
        method: 'GET',
        url: '/api/me/messages/conversations',
        headers: { cookie: cookieA },
      })
      expect(list.statusCode).toBe(200)
      const byUsername = new Map(
        (
          list.json() as Array<{
            id: string
            otherUser: { username: string; available: boolean }
          }>
        ).map((c) => [c.otherUser.username, c]),
      )
      expect(byUsername.get(userB.username)?.otherUser.available).toBe(true)
      expect(byUsername.get(suspended.username)?.otherUser.available).toBe(false)
      expect(byUsername.get(deleted.username)?.otherUser.available).toBe(false)

      const detail = await app.inject({
        method: 'GET',
        url: `/api/me/messages/conversations/${withDeleted.id}`,
        headers: { cookie: cookieA },
      })
      expect(detail.statusCode).toBe(200)
      const body = detail.json() as {
        otherUser: { available: boolean }
        messages: Array<{ body: string }>
      }
      expect(body.otherUser.available).toBe(false)
      expect(body.messages.map((m) => m.body)).toEqual(['Bye for now'])
    })
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
