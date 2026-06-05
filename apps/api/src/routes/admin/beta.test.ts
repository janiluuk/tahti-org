// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/email.js', () => ({
  sendBetaApplicationEmail: vi.fn().mockResolvedValue(undefined),
  sendBetaApprovedEmail: vi.fn().mockResolvedValue(undefined),
}))

import { sendBetaApprovedEmail } from '../../lib/email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-beta-'

describe('admin beta applications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let applicationId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.betaApplication.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-beta-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const apply = await app.inject({
      method: 'POST',
      url: '/api/beta/apply',
      payload: {
        name: 'Beta Artist',
        email: `${PREFIX}artist@example.com`,
        artistType: 'DJ',
        message: 'Ready to broadcast',
      },
    })
    expect(apply.statusCode).toBe(201)
    applicationId = (apply.json() as { applicationId: string }).applicationId
    expect(applicationId).toBeTruthy()
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { contactEmail: { startsWith: PREFIX } } })
    await prisma.betaApplication.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists pending beta applications for board', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/beta/applications?status=PENDING',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { applications: Array<{ id: string; email: string }> }
    expect(body.applications.some((a) => a.id === applicationId)).toBe(true)
  })

  it('approves application, creates user, and emails setup link', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/beta/applications/${applicationId}/approve`,
      headers: { cookie: boardCookie },
      payload: { username: 'beta-invite-artist', displayName: 'Beta Artist' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { setupUrl: string; userId: string }
    expect(body.setupUrl).toContain('/setup-password?token=')
    expect(body.userId).toBeTruthy()

    expect(sendBetaApprovedEmail).toHaveBeenCalled()

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { passwordHash: true, emailVerifiedAt: true, username: true },
    })
    expect(user?.passwordHash).toBeNull()
    expect(user?.emailVerifiedAt).toBeTruthy()
    expect(user?.username).toBe('beta-invite-artist')
  })
})
