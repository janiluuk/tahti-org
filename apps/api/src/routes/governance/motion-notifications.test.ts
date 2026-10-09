// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-notify-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe('motion notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string
  let memberId: string
  let suspendedId: string
  let freeId: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97300, lte: 97399 } } })
  }

  async function draftMotion(title: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title,
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date('2031-03-04T12:00:00.000Z').toISOString(),
      },
    })
    expect(res.statusCode).toBe(201)
    return res.json().id as string
  }

  async function setState(id: string, state: 'OPEN' | 'CLOSED') {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${id}`,
      headers: { cookie: boardCookie },
      payload: { state },
    })
    expect(res.statusCode).toBe(200)
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const passwordHash = await hashPassword('testpassword')
    const base = { passwordHash, emailVerifiedAt: new Date() }
    const board = await prisma.user.create({
      data: {
        ...base,
        email: `${PREFIX}board@example.com`,
        username: 'gov-notify-board',
        displayName: 'Notify Board',
        isMember: true,
        isBoard: true,
        memberNumber: 97301,
        memberSince: new Date(),
      },
    })
    const member = await prisma.user.create({
      data: {
        ...base,
        email: `${PREFIX}member@example.com`,
        username: 'gov-notify-member',
        displayName: 'Notify Member',
        isMember: true,
        memberNumber: 97302,
        memberSince: new Date(),
      },
    })
    const suspended = await prisma.user.create({
      data: {
        ...base,
        email: `${PREFIX}suspended@example.com`,
        username: 'gov-notify-suspended',
        displayName: 'Notify Suspended',
        isMember: true,
        memberNumber: 97303,
        memberSince: new Date(),
        suspendedAt: new Date(),
      },
    })
    const free = await prisma.user.create({
      data: {
        ...base,
        email: `${PREFIX}free@example.com`,
        username: 'gov-notify-free',
        displayName: 'Notify Free',
        isMember: false,
      },
    })
    boardId = board.id
    memberId = member.id
    suspendedId = suspended.id
    freeId = free.id
    boardCookie = cookie((await createSession(prisma, board.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('tells the other members when a motion opens, with a link to it', async () => {
    const id = await draftMotion('Open the archive on Sundays')
    expect(await prisma.notification.count({ where: { userId: memberId } })).toBe(0)

    await setState(id, 'OPEN')

    const rows = await prisma.notification.findMany({
      where: { userId: memberId, type: 'MOTION_OPENED' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.url).toBe(`/governance/motions/${id}`)
    expect(rows[0]!.body).toBe('"Open the archive on Sundays" is open until 2031-03-04.')
    expect(rows[0]!.actorUserId).toBe(boardId)
  })

  it('does not tell the board member who opened it, a suspended member or a non-member', async () => {
    const id = await draftMotion('Second proposal')
    await setState(id, 'OPEN')

    for (const userId of [boardId, suspendedId, freeId]) {
      expect(await prisma.notification.count({ where: { userId, type: 'MOTION_OPENED' } })).toBe(0)
    }
  })
})
