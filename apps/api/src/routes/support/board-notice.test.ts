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

const PREFIX = 'support-board-notice-'

describe('Board is told about support requests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardId: string
  let boardRequesterId: string
  let artistCookie: string
  let boardRequesterCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'sup-notice-board',
    })
    boardId = board.id
    const boardRequester = await createTestArtist(prisma, {
      email: `${PREFIX}board2@example.com`,
      username: 'sup-notice-board2',
    })
    boardRequesterId = boardRequester.id
    await prisma.user.updateMany({
      where: { id: { in: [board.id, boardRequester.id] } },
      data: { isBoard: true, isMember: true },
    })
    boardRequesterCookie = await sessionCookieFor(prisma, boardRequester.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sup-notice-artist',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const notices = (userId: string, subject: string) =>
    prisma.notification.findMany({
      where: { userId, type: 'SUPPORT_TICKET', title: { contains: subject } },
    })

  it('notifies every board member of a new request and of the requester replying', async () => {
    const subject = `${PREFIX}cannot upload`
    const res = await app.inject({
      method: 'POST',
      url: '/api/support/contact',
      headers: { cookie: artistCookie },
      payload: { subject, message: 'The upload stops at 99 %.', category: 'OTHER' },
    })
    expect(res.statusCode).toBe(201)
    const ticketId = (res.json() as { ticketId: string }).ticketId

    const first = await notices(boardId, subject)
    expect(first).toHaveLength(1)
    expect(first[0]?.title).toBe(`New support request: ${subject}`)
    expect(first[0]?.url).toBe('/admin/moderation/support')

    const replied = await app.inject({
      method: 'POST',
      url: `/api/me/support/tickets/${ticketId}/replies`,
      headers: { cookie: artistCookie },
      payload: { body: 'Still stuck today.' },
    })
    expect(replied.statusCode).toBe(201)
    const after = await notices(boardId, subject)
    expect(after.map((n) => n.title)).toContain(`Support request answered: ${subject}`)
  })

  it('does not notify a board member about their own request', async () => {
    const subject = `${PREFIX}board own`
    const res = await app.inject({
      method: 'POST',
      url: '/api/support/contact',
      headers: { cookie: boardRequesterCookie },
      payload: { subject, message: 'Testing the form.', category: 'OTHER' },
    })
    expect(res.statusCode).toBe(201)
    expect(await notices(boardRequesterId, subject)).toHaveLength(0)
    expect(await notices(boardId, subject)).toHaveLength(1)
  })
})
