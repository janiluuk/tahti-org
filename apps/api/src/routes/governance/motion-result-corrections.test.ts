// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-certfix-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

type Correction = {
  id: string
  note: string
  tally: { YES: number; NO: number; ABSTAIN: number } | null
  digest: string
  matchesRecord: boolean
}

type Certificate = {
  tally: { YES: number; NO: number; ABSTAIN: number }
  digest: string
  matchesRecord: boolean
  corrections: Correction[]
  correctedTally: { YES: number; NO: number; ABSTAIN: number } | null
}

describe('corrections to a motion result', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 96300, lte: 96349 } } })
  }

  async function closedMotion(title: string) {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title,
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    const id = created.json().id as string
    for (const state of ['OPEN', 'CLOSED']) {
      if (state === 'CLOSED') {
        await app.inject({
          method: 'POST',
          url: `/api/v1/governance/motions/${id}/vote`,
          headers: { cookie: memberCookie },
          payload: { choice: 'YES' },
        })
      }
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/governance/motions/${id}`,
        headers: { cookie: boardCookie },
        payload: { state },
      })
    }
    return id
  }

  function correct(id: string, payload: Record<string, unknown>, who = boardCookie) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/governance/motions/${id}/result-corrections`,
      headers: { cookie: who },
      payload,
    })
  }

  async function certificate(id: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${id}/certificate`,
      headers: { cookie: memberCookie },
    })
    return res.json() as Certificate
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
          username: `gov-certfix-${name}`,
          displayName: `Certfix ${name}`,
          isMember: true,
          isBoard,
          memberNumber,
          memberSince: new Date(),
        },
      })
    const board = await make('board', 96301, true)
    const member = await make('member', 96302)
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('appends corrections without touching the certificate', async () => {
    const id = await closedMotion('Corrected proposal')
    const before = await certificate(id)
    expect(before).toMatchObject({ corrections: [], correctedTally: null })

    const first = await correct(id, {
      note: 'One vote was cast by a member whose membership had lapsed.',
      tally: { YES: 0, NO: 0, ABSTAIN: 0 },
    })
    expect(first.statusCode).toBe(201)
    await correct(id, { note: 'Recount confirmed by the auditor.' })

    const after = await certificate(id)
    expect(after.digest).toBe(before.digest)
    expect(after.tally).toEqual(before.tally)
    expect(after.matchesRecord).toBe(true)
    expect(after.corrections.map((c) => [c.note, c.tally, c.matchesRecord])).toEqual([
      [
        'One vote was cast by a member whose membership had lapsed.',
        { YES: 0, NO: 0, ABSTAIN: 0 },
        true,
      ],
      ['Recount confirmed by the auditor.', null, true],
    ])
    expect(after.correctedTally).toEqual({ YES: 0, NO: 0, ABSTAIN: 0 })
    expect(after.corrections[0]!.digest).not.toBe(after.corrections[1]!.digest)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'MOTION_RESULT_CORRECT', targetId: id },
    })
    expect(audit?.meta).toMatchObject({ title: 'Corrected proposal' })
  })

  it('shows when an earlier correction was edited afterwards', async () => {
    const id = await closedMotion('Tampered proposal')
    const first = (await correct(id, { note: 'First note' })).json() as Correction
    await correct(id, { note: 'Second note' })
    await prisma.motionResultCorrection.update({
      where: { id: first.id },
      data: { note: 'Quietly rewritten' },
    })
    const cert = await certificate(id)
    expect(cert.corrections.map((c) => c.matchesRecord)).toEqual([false, false])
  })

  it('refuses motions without a certificate, impossible tallies and non-board callers', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Still a draft',
        description: 'Details',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    expect((await correct(created.json().id, { note: 'x' })).statusCode).toBe(409)

    const id = await closedMotion('Guarded proposal')
    expect((await correct(id, { note: 'x' }, memberCookie)).statusCode).toBe(403)
    expect((await correct(id, { note: '' })).statusCode).toBe(400)
    expect(
      (await correct(id, { note: 'x', tally: { YES: -1, NO: 0, ABSTAIN: 0 } })).statusCode,
    ).toBe(400)
    const eligible = (await prisma.motion.findUniqueOrThrow({ where: { id } })).eligibleMemberCount
    if (eligible !== null) {
      expect(
        (await correct(id, { note: 'x', tally: { YES: eligible + 1, NO: 0, ABSTAIN: 0 } }))
          .statusCode,
      ).toBe(400)
    }
    expect((await correct('missing-motion', { note: 'x' })).statusCode).toBe(404)
  })
})
