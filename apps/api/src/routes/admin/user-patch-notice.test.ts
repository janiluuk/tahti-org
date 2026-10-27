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

const PREFIX = 'user-patch-notice-'

describe('The account is told when the board changes its plan or roles', () => {
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
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const patch = (payload: object) =>
    app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${userId}`,
      headers: { cookie: boardCookie },
      payload,
    })

  const notices = () =>
    prisma.notification.findMany({ where: { userId, type: 'BOARD_ACCOUNT_CHANGE' } })

  it('lists what changed in one notice', async () => {
    expect((await patch({ tier: 'ARTIST', isMember: true })).statusCode).toBe(200)
    const [notice] = await notices()
    expect(notice).toMatchObject({
      title: 'The board updated your account',
      body: 'Plan: Free → Artist. Membership: started',
      url: '/settings/account',
    })
  })

  it('sends nothing when the values are unchanged', async () => {
    expect((await patch({ tier: 'ARTIST', isMember: true })).statusCode).toBe(200)
    expect(await notices()).toHaveLength(1)
  })
})
