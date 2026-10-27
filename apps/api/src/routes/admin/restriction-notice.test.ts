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

const PREFIX = 'restriction-notice-'

describe('The account is told about restrictions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const notices = () =>
    prisma.notification.findMany({
      where: { userId, type: 'ACCOUNT_RESTRICTED' },
      orderBy: { createdAt: 'asc' },
    })

  it('notifies on an upload ban and again when it is lifted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/restrictions`,
      headers: { cookie: boardCookie },
      payload: { type: 'UPLOAD', reason: 'Copyright strikes', durationDays: 7 },
    })
    expect(res.statusCode).toBe(201)
    const [blocked] = await notices()
    expect(blocked.title).toMatch(/^Uploads are blocked until \d{4}-\d{2}-\d{2}$/)
    expect(blocked).toMatchObject({ body: 'Reason: Copyright strikes', url: '/studio' })

    const lift = await app.inject({
      method: 'DELETE',
      url: `/api/admin/users/${userId}/restrictions/${res.json().id}`,
      headers: { cookie: boardCookie },
    })
    expect(lift.statusCode).toBe(200)
    const all = await notices()
    expect(all).toHaveLength(2)
    expect(all[1]).toMatchObject({ title: 'You can upload again', body: null })
  })

  it('sends nothing for a sign-in ban', async () => {
    const before = (await notices()).length
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/restrictions`,
      headers: { cookie: boardCookie },
      payload: { type: 'LOGIN', reason: 'Abuse' },
    })
    expect(res.statusCode).toBe(201)
    expect(await notices()).toHaveLength(before)
  })
})
