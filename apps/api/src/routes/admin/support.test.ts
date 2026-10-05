// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const sendMail = vi.hoisted(() => vi.fn())
vi.mock('../../lib/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/email.js')>()),
  sendMail,
}))

const PREFIX = 'admin-support-'

describe('M21-F — support tickets', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let artistId: string
  let ticketId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-sup-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-sup-artist',
    })
    artistId = artist.id
    artistCookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.supportTicketNote.deleteMany({})
    await prisma.supportTicket.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/support/contact creates ticket for signed-in artist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/support/contact',
      headers: { cookie: artistCookie },
      payload: {
        subject: 'Engagement looks wrong',
        message: 'My units seem low for September.',
        category: 'ENGAGEMENT_DISPUTE',
      },
    })
    expect(res.statusCode).toBe(201)
    ticketId = (res.json() as { ticketId: string }).ticketId
    expect(ticketId).toBeTruthy()
  })

  it('GET /api/admin/support/tickets lists ticket', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/support/tickets?status=OPEN',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { tickets: Array<{ id: string; artistId: string | null }> }
    expect(body.tickets.some((t) => t.id === ticketId && t.artistId === artistId)).toBe(true)
  })

  it('PATCH ticket and add note', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/support/tickets/${ticketId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'IN_PROGRESS' },
    })
    expect(patch.statusCode).toBe(200)

    const note = await app.inject({
      method: 'POST',
      url: `/api/admin/support/tickets/${ticketId}/notes`,
      headers: { cookie: boardCookie },
      payload: { body: 'Investigating ingest logs.' },
    })
    expect(note.statusCode).toBe(200)
    const detail = note.json() as {
      notes: Array<{ body: string; kind: string }>
    }
    expect(detail.notes.some((n) => n.body.includes('Investigating'))).toBe(true)
  })

  it('tells the requester about a board reply, by notification and email', async () => {
    sendMail.mockClear()
    const before = await prisma.notification.count({
      where: { userId: artistId, type: 'SUPPORT_REPLY' },
    })
    const note = await app.inject({
      method: 'POST',
      url: `/api/admin/support/tickets/${ticketId}/notes`,
      headers: { cookie: boardCookie },
      payload: { body: 'Fixed on our side, please try again.' },
    })
    expect(note.statusCode).toBe(200)

    const notices = await prisma.notification.findMany({
      where: { userId: artistId, type: 'SUPPORT_REPLY' },
      orderBy: { createdAt: 'desc' },
    })
    expect(notices).toHaveLength(before + 1)
    expect(notices[0]?.title).toContain('Tahti support replied to')
    expect(notices[0]?.body).toBe('Fixed on our side, please try again.')
    expect(notices[0]?.url).toBe('/help')
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: `${PREFIX}artist@example.com` })
  })

  it('emails a board reply to someone who wrote in while signed out', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        contactEmail: 'visitor@example.com',
        subject: 'Cannot sign up',
        message: 'The form fails.',
        category: 'OTHER',
      },
    })
    sendMail.mockClear()
    const before = await prisma.notification.count({ where: { type: 'SUPPORT_REPLY' } })
    const note = await app.inject({
      method: 'POST',
      url: `/api/admin/support/tickets/${ticket.id}/notes`,
      headers: { cookie: boardCookie },
      payload: { body: 'Try again now.' },
    })
    expect(note.statusCode).toBe(200)
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: 'visitor@example.com',
      subject: 'Tahti · Re: Cannot sign up',
      text: 'Try again now.',
    })
    expect(await prisma.notification.count({ where: { type: 'SUPPORT_REPLY' } })).toBe(before)
  })

  it("marks tickets where the next move is the board's", async () => {
    const awaiting = async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/support/tickets?limit=100',
        headers: { cookie: boardCookie },
      })
      const rows = res.json().tickets as Array<{ id: string; awaitingReply?: boolean }>
      return rows.find((t) => t.id === ticketId)?.awaitingReply
    }
    await prisma.supportTicketNote.deleteMany({ where: { ticketId: BigInt(ticketId) } })
    await prisma.supportTicket.update({
      where: { id: BigInt(ticketId) },
      data: { status: 'OPEN' },
    })
    expect(await awaiting()).toBe(true)

    await app.inject({
      method: 'POST',
      url: `/api/admin/support/tickets/${ticketId}/notes`,
      headers: { cookie: boardCookie },
      payload: { body: 'We are on it.' },
    })
    expect(await awaiting()).toBe(false)

    await prisma.supportTicketNote.create({
      data: { ticketId: BigInt(ticketId), body: 'Any update?', authorId: artistId },
    })
    expect(await awaiting()).toBe(true)

    await prisma.supportTicket.update({
      where: { id: BigInt(ticketId) },
      data: { status: 'RESOLVED' },
    })
    expect(await awaiting()).toBe(false)
    await prisma.supportTicket.update({
      where: { id: BigInt(ticketId) },
      data: { status: 'IN_PROGRESS' },
    })
  })

  it('lists only the tickets waiting on the board with awaitingReply=true', async () => {
    const answered = await prisma.supportTicket.create({
      data: {
        artistId,
        subject: 'Already answered',
        message: 'Thanks',
        category: 'OTHER',
        status: 'IN_PROGRESS',
      },
    })
    const board = await prisma.user.findUniqueOrThrow({ where: { username: 'admin-sup-board' } })
    await prisma.supportTicketNote.create({
      data: { ticketId: answered.id, body: 'Done.', authorId: board.id },
    })
    const waiting = await prisma.supportTicket.create({
      data: { artistId, subject: 'Still waiting', message: 'Hello?', category: 'OTHER' },
    })
    const resolved = await prisma.supportTicket.create({
      data: {
        artistId,
        subject: 'Closed',
        message: 'Fixed',
        category: 'OTHER',
        status: 'RESOLVED',
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/support/tickets?awaitingReply=true&limit=100',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { total: number; tickets: Array<{ id: string }> }
    const ids = body.tickets.map((t) => t.id)
    expect(ids).toContain(waiting.id.toString())
    expect(ids).not.toContain(answered.id.toString())
    expect(ids).not.toContain(resolved.id.toString())
    expect(body.total).toBe(ids.length)
  })

  it('PATCH status transition auto-logs a STATUS_CHANGE timeline entry', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/support/tickets/${ticketId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'RESOLVED' },
    })
    expect(patch.statusCode).toBe(200)
    const detail = patch.json() as {
      status: string
      notes: Array<{ body: string; kind: string }>
    }
    expect(detail.status).toBe('RESOLVED')
    const transitions = detail.notes.filter((n) => n.kind === 'STATUS_CHANGE')
    expect(transitions.at(-1)?.body).toBe('Status changed from IN_PROGRESS to RESOLVED')

    // A no-op PATCH (status unchanged) must not add another transition row.
    const before = detail.notes.filter((n) => n.kind === 'STATUS_CHANGE').length
    const noop = await app.inject({
      method: 'PATCH',
      url: `/api/admin/support/tickets/${ticketId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'RESOLVED' },
    })
    const noopDetail = noop.json() as { notes: Array<{ kind: string }> }
    const after = noopDetail.notes.filter((n) => n.kind === 'STATUS_CHANGE').length
    expect(after).toBe(before)
  })

  it('GET /api/admin/support/tickets?q= searches subject, message, and requester', async () => {
    const bySubject = await app.inject({
      method: 'GET',
      url: '/api/admin/support/tickets?q=Engagement+looks+wrong',
      headers: { cookie: boardCookie },
    })
    expect(bySubject.statusCode).toBe(200)
    const bySubjectBody = bySubject.json() as { tickets: Array<{ id: string }> }
    expect(bySubjectBody.tickets.some((t) => t.id === ticketId)).toBe(true)

    const byRequester = await app.inject({
      method: 'GET',
      url: '/api/admin/support/tickets?q=admin-sup-artist',
      headers: { cookie: boardCookie },
    })
    const byRequesterBody = byRequester.json() as { tickets: Array<{ id: string }> }
    expect(byRequesterBody.tickets.some((t) => t.id === ticketId)).toBe(true)

    const noMatch = await app.inject({
      method: 'GET',
      url: '/api/admin/support/tickets?q=zzz-no-such-ticket-zzz',
      headers: { cookie: boardCookie },
    })
    const noMatchBody = noMatch.json() as { tickets: Array<{ id: string }> }
    expect(noMatchBody.tickets.some((t) => t.id === ticketId)).toBe(false)
  })

  it('POST engagement adjustment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/engagement/adjustment',
      headers: { cookie: boardCookie },
      payload: { userId: artistId, units: 420, reason: 'ingest failure test' },
    })
    expect(res.statusCode).toBe(200)

    const eng = await app.inject({
      method: 'GET',
      url: `/api/admin/users/${artistId}/engagement`,
      headers: { cookie: boardCookie },
    })
    expect(eng.statusCode).toBe(200)
    const body = eng.json() as { adjustments: Array<{ units: number }> }
    expect(body.adjustments.some((a) => a.units === 420)).toBe(true)
  })
})
