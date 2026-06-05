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
    const detail = note.json() as { notes: Array<{ body: string }> }
    expect(detail.notes.some((n) => n.body.includes('Investigating'))).toBe(true)
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
