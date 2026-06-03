// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-members-'

describe('GET /api/admin/members/export.csv', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberEmail: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    memberEmail = `${PREFIX}member@example.com`
    await createTestArtist(prisma, {
      email: memberEmail,
      username: 'admin-members-m',
      isMember: true,
      memberNumber: 98201,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-members-b',
      isBoard: true,
      isMember: true,
      memberNumber: 98200,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires board role', async () => {
    const member = await prisma.user.findFirst({ where: { email: memberEmail } })
    const cookie = await sessionCookieFor(prisma, member!.id)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/members/export.csv',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns CSV with member rows', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/members/export.csv',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('memberNumber')
    expect(res.body).toContain(memberEmail)
    expect(res.body).toContain('98201')
  })
})
