// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-draft-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe("a proposer's own motion draft", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let proposerCookie: string
  let memberCookie: string
  let proposerId: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97500, lte: 97599 } } })
  }

  async function draft(who = proposerCookie, title = 'Draft proposal') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: who },
      payload: {
        title,
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    return res.json().id as string
  }

  function withdraw(id: string, who: string) {
    return app.inject({
      method: 'DELETE',
      url: `/api/v1/governance/motions/${id}`,
      headers: { cookie: who },
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
          username: `gov-draft-${name}`,
          displayName: `Draft ${name}`,
          isMember: true,
          isBoard,
          memberNumber,
          memberSince: new Date(),
        },
      })
    const board = await make('board', 97501, true)
    const proposer = await make('proposer', 97502)
    const member = await make('member', 97503)
    proposerId = proposer.id
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    proposerCookie = cookie((await createSession(prisma, proposer.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  describe('withdrawing', () => {
    it('removes the draft, its seconds and its discussion, and keeps an audit entry', async () => {
      const id = await draft()
      await app.inject({
        method: 'POST',
        url: `/api/v1/governance/motions/${id}/second`,
        headers: { cookie: memberCookie },
      })
      await app.inject({
        method: 'POST',
        url: `/api/v1/governance/motions/${id}/comments`,
        headers: { cookie: memberCookie },
        payload: { body: 'Looks fine' },
      })

      const res = await withdraw(id, proposerCookie)
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ ok: true })

      expect(await prisma.motion.findUnique({ where: { id } })).toBeNull()
      expect(await prisma.motionSecond.count({ where: { motionId: id } })).toBe(0)
      expect(await prisma.motionComment.count({ where: { motionId: id } })).toBe(0)
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'MOTION_WITHDRAW', targetId: id },
      })
      expect(audit).toMatchObject({ actorId: proposerId, meta: { title: 'Draft proposal' } })
      expect((await withdraw(id, proposerCookie)).statusCode).toBe(404)
    })

    it('is only for the proposer, board included', async () => {
      const id = await draft()
      expect((await withdraw(id, memberCookie)).statusCode).toBe(403)
      expect((await withdraw(id, boardCookie)).statusCode).toBe(403)
      expect(await prisma.motion.findUnique({ where: { id } })).not.toBeNull()
    })

    it('is refused once the board has opened the motion', async () => {
      const id = await draft()
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/governance/motions/${id}`,
        headers: { cookie: boardCookie },
        payload: { state: 'OPEN' },
      })
      expect((await withdraw(id, proposerCookie)).statusCode).toBe(409)
      expect(await prisma.motion.findUnique({ where: { id } })).not.toBeNull()
    })

    it('needs a signed-in member', async () => {
      const id = await draft()
      const res = await app.inject({ method: 'DELETE', url: `/api/v1/governance/motions/${id}` })
      expect(res.statusCode).toBe(401)
    })
  })
})
