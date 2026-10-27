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

const PREFIX = 'admin-discussions-'

describe('/api/admin/discussions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let boardId: string

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
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      isMember: true,
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets the board open, pin and close a topic; the opener follows it', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/discussions',
      headers: { cookie: boardCookie },
      payload: { title: 'Festival stage 2027', body: 'Who wants to play?' },
    })
    expect(created.statusCode).toBe(201)
    const topic = created.json()
    expect(topic).toMatchObject({
      title: 'Festival stage 2027',
      status: 'OPEN',
      pinned: false,
      postCount: 0,
    })
    expect(
      await prisma.discussionParticipant.count({ where: { topicId: topic.id, userId: boardId } }),
    ).toBe(1)

    const closed = await app.inject({
      method: 'PATCH',
      url: `/api/admin/discussions/${topic.id}`,
      headers: { cookie: boardCookie },
      payload: { pinned: true, status: 'CLOSED' },
    })
    expect(closed.json()).toMatchObject({ pinned: true, status: 'CLOSED' })
  })

  it('is board-only and validates input', async () => {
    const asMember = await app.inject({
      method: 'POST',
      url: '/api/admin/discussions',
      headers: { cookie: memberCookie },
      payload: { title: 'Nope', body: 'x' },
    })
    expect(asMember.statusCode).toBe(403)
    const empty = await app.inject({
      method: 'POST',
      url: '/api/admin/discussions',
      headers: { cookie: boardCookie },
      payload: { title: 'x', body: '' },
    })
    expect(empty.statusCode).toBe(400)
  })
})
