// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-cert-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

type Certificate = {
  motionId: string
  tally: { YES: number; NO: number; ABSTAIN: number }
  totalVotes: number
  digest: string
  matchesRecord: boolean
  closedAt: string
}

describe('the result certificate of a motion', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let freeCookie: string
  let memberId: string
  let motionId: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97800, lte: 97899 } } })
  }

  function certificate(who = memberCookie, id = motionId) {
    return app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${id}/certificate`,
      headers: { cookie: who },
    })
  }

  function setState(state: 'OPEN' | 'CLOSED', id = motionId) {
    return app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${id}`,
      headers: { cookie: boardCookie },
      payload: { state },
    })
  }

  function vote(who: string, choice: string) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: who },
      payload: { choice },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const passwordHash = await hashPassword('testpassword')
    const make = (name: string, memberNumber: number | null, isBoard = false) =>
      prisma.user.create({
        data: {
          passwordHash,
          emailVerifiedAt: new Date(),
          email: `${PREFIX}${name}@example.com`,
          username: `gov-cert-${name}`,
          displayName: `Cert ${name}`,
          isMember: memberNumber !== null,
          isBoard,
          memberNumber,
          memberSince: memberNumber !== null ? new Date() : null,
        },
      })
    const board = await make('board', 97801, true)
    const member = await make('member', 97802)
    const free = await make('free', null)
    memberId = member.id
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
    freeCookie = cookie((await createSession(prisma, free.id)).id)

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Certified proposal',
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    motionId = created.json().id
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('does not exist before the motion is closed', async () => {
    expect((await certificate()).statusCode).toBe(409)
    await setState('OPEN')
    expect((await certificate()).statusCode).toBe(409)
  })

  it('fixes the tally when the board closes the motion', async () => {
    await vote(boardCookie, 'YES')
    await vote(memberCookie, 'NO')
    await setState('CLOSED')

    const res = await certificate()
    expect(res.statusCode).toBe(200)
    const cert = res.json() as Certificate
    expect(cert).toMatchObject({
      motionId,
      title: 'Certified proposal',
      tally: { YES: 1, NO: 1, ABSTAIN: 0 },
      totalVotes: 2,
      algorithm: 'sha256',
      matchesRecord: true,
    })
    expect(cert.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(Number.isNaN(Date.parse(cert.closedAt))).toBe(false)

    // Reading it again gives the same certificate.
    expect(((await certificate()).json() as Certificate).digest).toBe(cert.digest)
  })

  it('is for members only', async () => {
    expect((await certificate(freeCookie)).statusCode).toBe(403)
    expect((await certificate(memberCookie, 'missing-motion')).statusCode).toBe(404)
  })

  it('keeps the certified tally and says so when a vote row later disappears', async () => {
    await prisma.vote.delete({ where: { motionId_userId: { motionId, userId: memberId } } })
    const cert = (await certificate()).json() as Certificate
    expect(cert.tally).toEqual({ YES: 1, NO: 1, ABSTAIN: 0 })
    expect(cert.matchesRecord).toBe(false)
  })

  it('says so when the motion text is changed after closing', async () => {
    await prisma.vote.create({ data: { motionId, userId: memberId, choice: 'NO' } })
    expect(((await certificate()).json() as Certificate).matchesRecord).toBe(true)
    await prisma.motion.update({ where: { id: motionId }, data: { title: 'Rewritten afterwards' } })
    expect(((await certificate()).json() as Certificate).matchesRecord).toBe(false)
  })

  it('answers 404 for a motion closed before certificates existed', async () => {
    await prisma.motion.update({
      where: { id: motionId },
      data: { resultDigest: null, closedAt: null },
    })
    expect((await certificate()).statusCode).toBe(404)
  })
})
