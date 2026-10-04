// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { MySupportTicketListSchema, SUPPORT_REPLY_AUTHOR_NAME } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-support-tickets-'

describe('GET /api/me/support/tickets', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let ownTicketId: bigint
  let otherTicketId: bigint
  let signedOutTicketId: bigint

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    await prisma.user.update({
      where: { id: board.id },
      data: { isBoard: true, isMember: true, displayName: 'Board Person' },
    })
    const requester = await createTestArtist(prisma, {
      email: `${PREFIX}requester@example.com`,
      username: `${PREFIX}requester`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    cookie = await sessionCookieFor(prisma, requester.id)

    const own = await prisma.supportTicket.create({
      data: {
        artistId: requester.id,
        subject: 'Payout missing',
        message: 'Where is my payout?',
        category: 'FINANCIAL',
        status: 'IN_PROGRESS',
        notes: {
          create: [
            { kind: 'MESSAGE', body: 'Looking into it', authorId: board.id },
            {
              kind: 'STATUS_CHANGE',
              body: 'Status changed from OPEN to IN_PROGRESS',
              authorId: board.id,
            },
          ],
        },
      },
    })
    ownTicketId = own.id
    const otherTicket = await prisma.supportTicket.create({
      data: {
        artistId: other.id,
        subject: 'Someone else',
        message: 'Not yours',
        category: 'OTHER',
        notes: { create: [{ kind: 'MESSAGE', body: 'Private reply', authorId: board.id }] },
      },
    })
    otherTicketId = otherTicket.id
    const signedOut = await prisma.supportTicket.create({
      data: {
        contactEmail: `${PREFIX}requester@example.com`,
        subject: 'Filed while signed out',
        message: 'Same email, no account link',
        category: 'OTHER',
      },
    })
    signedOutTicketId = signedOut.id
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({
      where: { id: { in: [ownTicketId, otherTicketId, signedOutTicketId] } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/support/tickets' })
    expect(res.statusCode).toBe(401)
  })

  it("returns only the caller's own tickets, matched by user id", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/support/tickets',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = MySupportTicketListSchema.parse(res.json())
    expect(body.tickets.map((t) => t.id)).toEqual([ownTicketId.toString()])
    expect(body.tickets[0]).toMatchObject({
      subject: 'Payout missing',
      message: 'Where is my payout?',
      category: 'FINANCIAL',
      status: 'IN_PROGRESS',
    })
  })

  it('includes board replies signed as Tahti support and excludes status-change rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/support/tickets',
      headers: { cookie },
    })
    const [ticket] = MySupportTicketListSchema.parse(res.json()).tickets
    expect(ticket?.replies).toHaveLength(1)
    expect(ticket?.replies[0]).toMatchObject({
      body: 'Looking into it',
      authorName: SUPPORT_REPLY_AUTHOR_NAME,
    })
    expect(res.body).not.toContain('Status changed')
    expect(res.body).not.toContain('Board Person')
    expect(res.body).not.toContain('@example.com')
  })

  it('lets the requester reply on their own ticket and reopens a resolved one', async () => {
    await prisma.supportTicket.update({ where: { id: ownTicketId }, data: { status: 'RESOLVED' } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${ownTicketId}/replies`,
      headers: { cookie },
      payload: { body: 'Still missing, sorry.' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      body: 'Still missing, sorry.',
      authorName: 'You',
      fromRequester: true,
    })

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/support/tickets',
      headers: { cookie },
    })
    const [ticket] = MySupportTicketListSchema.parse(list.json()).tickets
    expect(ticket?.status).toBe('OPEN')
    expect(ticket?.replies.map((r) => [r.body, r.fromRequester])).toEqual([
      ['Looking into it', false],
      ['Still missing, sorry.', true],
    ])
    expect(list.body).not.toContain('Status changed')
  })

  it("refuses a reply on someone else's ticket, a signed-out ticket, or without a body", async () => {
    for (const id of [otherTicketId, signedOutTicketId]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/support/tickets/${id}/replies`,
        headers: { cookie },
        payload: { body: 'let me in' },
      })
      expect(res.statusCode).toBe(404)
    }
    const empty = await app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${ownTicketId}/replies`,
      headers: { cookie },
      payload: { body: '   ' },
    })
    expect(empty.statusCode).toBe(400)
    const anon = await app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${ownTicketId}/replies`,
      payload: { body: 'hello' },
    })
    expect(anon.statusCode).toBe(401)
  })
})
