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

const PREFIX = 'support-close-'

describe('POST /api/me/support/tickets/:id/close', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
    cookie = await sessionCookieFor(prisma, user.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const close = (id: bigint, c: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${id}/close`,
      headers: { cookie: c },
    })

  it('resolves the requester’s own ticket with a status row, once', async () => {
    const ticket = await prisma.supportTicket.create({
      data: { artistId: userId, subject: `${PREFIX}fixed`, message: 'Hi', category: 'OTHER' },
    })
    expect((await close(ticket.id, otherCookie)).statusCode).toBe(404)

    const res = await close(ticket.id, cookie)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'RESOLVED' })
    const after = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: { notes: true },
    })
    expect(after.status).toBe('RESOLVED')
    expect(after.notes).toHaveLength(1)
    expect(after.notes[0]?.kind).toBe('STATUS_CHANGE')

    expect((await close(ticket.id, cookie)).statusCode).toBe(200)
    expect(await prisma.supportTicketNote.count({ where: { ticketId: ticket.id } })).toBe(1)
  })

  it('reopens when the requester replies afterwards', async () => {
    const ticket = await prisma.supportTicket.create({
      data: { artistId: userId, subject: `${PREFIX}again`, message: 'Hi', category: 'OTHER' },
    })
    await close(ticket.id, cookie)
    const replied = await app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${ticket.id}/replies`,
      headers: { cookie },
      payload: { body: 'Actually it broke again.' },
    })
    expect(replied.statusCode).toBe(201)
    expect(
      (await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).status,
    ).toBe('OPEN')
  })
})
