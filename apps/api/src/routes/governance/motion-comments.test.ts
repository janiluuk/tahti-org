// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-comment-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

type CommentView = { id: string; body: string; removed: boolean; authorDisplayName: string | null }

describe('removing a motion comment', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let authorCookie: string
  let otherCookie: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97600, lte: 97699 } } })
  }

  async function motion() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Discussed proposal',
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    return res.json().id as string
  }

  async function comment(motionId: string, who: string, body: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: who },
      payload: { body },
    })
    return res.json() as CommentView
  }

  function remove(motionId: string, commentId: string, who: string) {
    return app.inject({
      method: 'DELETE',
      url: `/api/v1/governance/motions/${motionId}/comments/${commentId}`,
      headers: { cookie: who },
    })
  }

  async function thread(motionId: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}/comments`,
      headers: { cookie: otherCookie },
    })
    return res.json() as CommentView[]
  }

  function setState(motionId: string, state: 'OPEN' | 'CLOSED') {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const passwordHash = await hashPassword('testpassword')
    const make = (name: string, memberNumber: number, isBoard = false) =>
      prisma.user.create({
        data: {
          passwordHash,
          emailVerifiedAt: new Date(),
          email: `${PREFIX}${name}@example.com`,
          username: `gov-comment-${name}`,
          displayName: `Comment ${name}`,
          isMember: true,
          isBoard,
          memberNumber,
          memberSince: new Date(),
        },
      })
    const board = await make('board', 97601, true)
    const author = await make('author', 97602)
    const other = await make('other', 97603)
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    authorCookie = cookie((await createSession(prisma, author.id)).id)
    otherCookie = cookie((await createSession(prisma, other.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('lets the author remove their comment, keeping its place in the thread', async () => {
    const motionId = await motion()
    const first = await comment(motionId, authorCookie, 'Posted to the wrong motion')
    await comment(motionId, otherCookie, 'A reply')
    expect(first.removed).toBe(false)

    const res = await remove(motionId, first.id, authorCookie)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    // Removing it again changes nothing.
    expect((await remove(motionId, first.id, authorCookie)).statusCode).toBe(200)

    const rows = await thread(motionId)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: first.id,
      body: '',
      removed: true,
      authorDisplayName: 'Comment author',
    })
    expect(rows[1]).toMatchObject({ body: 'A reply', removed: false })

    const bulk = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/comments?ids=${motionId}`,
      headers: { cookie: otherCookie },
    })
    expect((bulk.json() as Record<string, CommentView[]>)[motionId]![0]).toMatchObject({
      body: '',
      removed: true,
    })
    expect(
      await prisma.auditLog.count({
        where: { action: 'MOTION_COMMENT_REMOVE', targetId: motionId },
      }),
    ).toBe(1)
  })

  it("does not let a member remove someone else's comment", async () => {
    const motionId = await motion()
    const posted = await comment(motionId, authorCookie, 'Mine')
    expect((await remove(motionId, posted.id, otherCookie)).statusCode).toBe(403)
    expect((await thread(motionId))[0]).toMatchObject({ body: 'Mine', removed: false })
  })

  it('keeps the discussion of a closed motion', async () => {
    const motionId = await motion()
    const posted = await comment(motionId, authorCookie, 'On the record')
    await setState(motionId, 'OPEN')
    await setState(motionId, 'CLOSED')
    expect((await remove(motionId, posted.id, authorCookie)).statusCode).toBe(409)
    expect((await thread(motionId))[0]).toMatchObject({ body: 'On the record', removed: false })
  })

  it("lets the board remove a member's comment, even after the motion closed", async () => {
    const motionId = await motion()
    const posted = await comment(motionId, authorCookie, 'Something that must not stay up')
    await setState(motionId, 'OPEN')
    await setState(motionId, 'CLOSED')

    const res = await remove(motionId, posted.id, boardCookie)
    expect(res.statusCode).toBe(200)
    expect((await thread(motionId))[0]).toMatchObject({
      body: '',
      removed: true,
      authorDisplayName: 'Comment author',
    })
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'MOTION_COMMENT_REMOVE', targetId: motionId },
    })
    expect(audit?.meta).toMatchObject({ commentId: posted.id, byAuthor: false })
  })

  it('tells the proposer about a comment on their motion, but not about their own', async () => {
    // The board account proposes every motion in this file.
    const board = await prisma.user.findUniqueOrThrow({
      where: { email: `${PREFIX}board@example.com` },
    })
    const motionId = await motion()
    const url = `/governance/motions/${motionId}`
    await comment(motionId, boardCookie, 'My own note')
    expect(await prisma.notification.count({ where: { userId: board.id, url } })).toBe(0)

    await comment(motionId, authorCookie, 'A question for the proposer')
    const notes = await prisma.notification.findMany({ where: { userId: board.id, url } })
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ type: 'MOTION_COMMENT', title: 'New comment on your motion' })
    expect(notes[0]!.body).toContain('Discussed proposal')
    // The comment text is not copied into the notification.
    expect(notes[0]!.body).not.toContain('A question for the proposer')
  })

  it('answers 404 for a comment that is not on that motion, and 400 for a bad id', async () => {
    const motionId = await motion()
    const elsewhere = await motion()
    const posted = await comment(motionId, authorCookie, 'Here')
    expect((await remove(elsewhere, posted.id, authorCookie)).statusCode).toBe(404)
    expect((await remove(motionId, '999999999999', authorCookie)).statusCode).toBe(404)
    expect((await remove(motionId, 'abc', authorCookie)).statusCode).toBe(400)
  })
})
