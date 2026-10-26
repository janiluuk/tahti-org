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

const PREFIX = 'support-resolved-'

describe('Support ticket resolved notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'sup-resolved-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sup-resolved-artist',
    })
    artistId = artist.id
    await prisma.user.update({ where: { id: artist.id }, data: { emailVerifiedAt: new Date() } })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const patch = (id: bigint, status: string) =>
    app.inject({
      method: 'PATCH',
      url: `/api/admin/support/tickets/${id}`,
      headers: { cookie: boardCookie },
      payload: { status },
    })

  it('tells an account by notification and email when its ticket is resolved', async () => {
    const ticket = await prisma.supportTicket.create({
      data: { artistId, subject: `${PREFIX}upload stuck`, message: 'Help', category: 'OTHER' },
    })
    sendMail.mockClear()

    expect((await patch(ticket.id, 'IN_PROGRESS')).statusCode).toBe(200)
    expect(sendMail).not.toHaveBeenCalled()

    expect((await patch(ticket.id, 'RESOLVED')).statusCode).toBe(200)
    const notice = await prisma.notification.findFirst({
      where: { userId: artistId, type: 'SUPPORT_REPLY', title: { contains: 'was resolved' } },
    })
    expect(notice?.url).toBe('/help')
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      to: `${PREFIX}artist@example.com`,
      subject: `Tahti · Resolved: ${PREFIX}upload stuck`,
    })

    sendMail.mockClear()
    expect((await patch(ticket.id, 'RESOLVED')).statusCode).toBe(200)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('emails the contact address of a ticket sent while signed out', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        contactEmail: `${PREFIX}guest@example.com`,
        subject: `${PREFIX}guest question`,
        message: 'Hi',
        category: 'OTHER',
      },
    })
    sendMail.mockClear()
    expect((await patch(ticket.id, 'RESOLVED')).statusCode).toBe(200)
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({ to: `${PREFIX}guest@example.com` })
  })
})
