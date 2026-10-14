// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-corr-admin-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

type AdminRow = {
  id: string
  state: string
  resolutionNote: string | null
  requester: { displayName: string; username: string; memberNumber: number | null }
}

describe('the board answers correction requests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let secondBoardCookie: string
  let memberCookie: string
  let boardId: string
  let memberId: string

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 98000, lte: 98099 } } })
  }

  async function file(who: string, details = 'My name is misspelled in the register.') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/corrections',
      headers: { cookie: who },
      payload: { subject: 'MEMBER_REGISTER', details },
    })
    return res.json().id as string
  }

  function queue(who: string, query = '') {
    return app.inject({
      method: 'GET',
      url: `/api/admin/governance/corrections${query}`,
      headers: { cookie: who },
    })
  }

  function answer(who: string, id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/corrections/${id}`,
      headers: { cookie: who },
      payload,
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
          username: `gov-corr-admin-${name}`,
          displayName: `CorrAdmin ${name}`,
          isMember: true,
          isBoard,
          memberNumber,
          memberSince: new Date(),
        },
      })
    const board = await make('board', 98001, true)
    const secondBoard = await make('board2', 98002, true)
    const member = await make('member', 98003)
    boardId = board.id
    memberId = member.id
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    secondBoardCookie = cookie((await createSession(prisma, secondBoard.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  function ours(rows: AdminRow[]) {
    return rows.filter((r) => r.requester.username.startsWith('gov-corr-admin-'))
  }

  it('shows the board the queue with who asked, oldest first', async () => {
    const first = await file(memberCookie, 'First: my name is misspelled.')
    const second = await file(memberCookie, 'Second: my joining date is wrong.')

    const res = await queue(boardCookie, '?state=OPEN')
    expect(res.statusCode).toBe(200)
    const rows = ours(res.json() as AdminRow[])
    expect(rows.map((r) => r.id)).toEqual([first, second])
    expect(rows[0]!.requester).toEqual({
      displayName: 'CorrAdmin member',
      username: 'gov-corr-admin-member',
      memberNumber: 98003,
    })
  })

  it('is for the board only', async () => {
    const id = await file(memberCookie)
    expect((await queue(memberCookie)).statusCode).toBe(403)
    expect(
      (await answer(memberCookie, id, { state: 'ACCEPTED', resolutionNote: 'Done' })).statusCode,
    ).toBe(403)
    expect((await queue(boardCookie, '?state=NOPE')).statusCode).toBe(400)
  })

  it('records the answer once and shows it to the member', async () => {
    const id = await file(memberCookie)
    const res = await answer(boardCookie, id, {
      state: 'ACCEPTED',
      resolutionNote: 'Corrected in the register today.',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id,
      state: 'ACCEPTED',
      resolutionNote: 'Corrected in the register today.',
    })

    const again = await answer(secondBoardCookie, id, {
      state: 'REJECTED',
      resolutionNote: 'Changed my mind',
    })
    expect(again.statusCode).toBe(409)

    const row = await prisma.governanceCorrectionRequest.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ state: 'ACCEPTED', resolvedById: boardId })
    expect(row.resolvedAt).not.toBeNull()

    const mine = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/corrections',
      headers: { cookie: memberCookie },
    })
    const seen = (mine.json() as Array<{ id: string; state: string; resolutionNote: string }>).find(
      (r) => r.id === id,
    )
    expect(seen).toMatchObject({
      state: 'ACCEPTED',
      resolutionNote: 'Corrected in the register today.',
    })

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CORRECTION_RESOLVE', targetId: id },
    })
    expect(audit).toMatchObject({ actorId: boardId, meta: { state: 'ACCEPTED' } })
    expect(memberId).not.toBe(boardId)
  })

  it('needs a note, a valid outcome and an existing request', async () => {
    const id = await file(memberCookie)
    expect((await answer(boardCookie, id, { state: 'ACCEPTED' })).statusCode).toBe(400)
    expect((await answer(boardCookie, id, { state: 'OPEN', resolutionNote: 'x' })).statusCode).toBe(
      400,
    )
    expect(
      (await answer(boardCookie, 'missing', { state: 'REJECTED', resolutionNote: 'x' })).statusCode,
    ).toBe(404)
  })

  it('does not let a board member answer their own request', async () => {
    const id = await file(boardCookie)
    const own = await answer(boardCookie, id, { state: 'ACCEPTED', resolutionNote: 'Approved' })
    expect(own.statusCode).toBe(403)
    const other = await answer(secondBoardCookie, id, {
      state: 'ACCEPTED',
      resolutionNote: 'Approved',
    })
    expect(other.statusCode).toBe(200)
  })
})
