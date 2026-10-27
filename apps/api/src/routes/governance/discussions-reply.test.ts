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

const PREFIX = 'discussions-reply-'

describe('Members reply to discussion topics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberId: string
  let memberCookie: string
  let outsiderCookie: string
  let openId: string
  let closedId: string

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
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      displayName: 'Member Eero',
      isMember: true,
    })
    memberId = member.id
    memberCookie = await sessionCookieFor(prisma, member.id)
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: `${PREFIX}outsider`,
    })
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
    const open = await prisma.discussionTopic.create({
      data: {
        title: `${PREFIX}open`,
        body: 'b',
        createdById: board.id,
        lastPostAt: new Date(Date.now() - 86_400_000),
      },
    })
    openId = open.id
    const closed = await prisma.discussionTopic.create({
      data: { title: `${PREFIX}closed`, body: 'b', createdById: board.id, status: 'CLOSED' },
    })
    closedId = closed.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('posts a reply, bumps the topic and makes the replier a follower', async () => {
    const before = await prisma.discussionTopic.findUniqueOrThrow({ where: { id: openId } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${openId}/posts`,
      headers: { cookie: memberCookie },
      payload: { body: '  Agreed  ' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ body: 'Agreed', author: 'Member Eero' })
    const after = await prisma.discussionTopic.findUniqueOrThrow({ where: { id: openId } })
    expect(after.lastPostAt.getTime()).toBeGreaterThan(before.lastPostAt.getTime())
    const participant = await prisma.discussionParticipant.findUnique({
      where: { topicId_userId: { topicId: openId, userId: memberId } },
    })
    expect(participant).not.toBeNull()
  })

  it('a second reply keeps one participant row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${openId}/posts`,
      headers: { cookie: memberCookie },
      payload: { body: 'Again' },
    })
    expect(res.statusCode).toBe(201)
    expect(await prisma.discussionParticipant.count({ where: { topicId: openId } })).toBe(1)
  })

  it('refuses replies to a closed topic', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${closedId}/posts`,
      headers: { cookie: memberCookie },
      payload: { body: 'Late' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('rejects an empty reply, an unknown topic and non-members', async () => {
    const empty = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${openId}/posts`,
      headers: { cookie: memberCookie },
      payload: { body: '   ' },
    })
    expect(empty.statusCode).toBe(400)
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/discussions/nope/posts',
      headers: { cookie: memberCookie },
      payload: { body: 'Hi' },
    })
    expect(missing.statusCode).toBe(404)
    const outsider = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${openId}/posts`,
      headers: { cookie: outsiderCookie },
      payload: { body: 'Hi' },
    })
    expect(outsider.statusCode).toBe(403)
  })
})
