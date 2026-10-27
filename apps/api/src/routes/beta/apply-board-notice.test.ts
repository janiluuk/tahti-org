// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/email.js', () => ({
  sendBetaApplicationEmail: vi.fn().mockResolvedValue(undefined),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'beta-board-notice-'

describe('Board is told about beta applications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardId = board.id
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { contactEmail: `${PREFIX}dj@example.com` } })
    await prisma.betaApplication.deleteMany({ where: { email: `${PREFIX}dj@example.com` } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies the board of the ticket an application opens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/beta/apply',
      payload: {
        name: 'Notice DJ',
        email: `${PREFIX}dj@example.com`,
        artistType: 'DJ / live electronics',
      },
    })
    expect(res.statusCode).toBe(201)
    const notices = await prisma.notification.findMany({
      where: { userId: boardId, type: 'SUPPORT_TICKET' },
    })
    expect(notices.map((n) => n.title)).toContain(
      'New support request: Beta application: Notice DJ',
    )
  })
})
