// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'governance-boardterm-test-'
const day = 86400000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

describe('board terms', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  const ids: Record<string, string> = {}

  async function cleanup() {
    await prisma.governanceBoardTerm.deleteMany({
      where: { displayName: { startsWith: 'Term ' } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function record(payload: Record<string, unknown>, who = boardCookie) {
    return app.inject({
      method: 'POST',
      url: '/api/admin/governance/board-terms',
      headers: { cookie: who },
      payload,
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const make = async (name: string, extra: Record<string, boolean>) => {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `governance-boardterm-${name}`,
        ...extra,
      })
      await prisma.user.update({ where: { id: user.id }, data: { displayName: `Term ${name}` } })
      ids[name] = user.id
      return user
    }
    boardCookie = await sessionCookieFor(
      prisma,
      (await make('board', { isMember: true, isBoard: true })).id,
    )
    memberCookie = await sessionCookieFor(prisma, (await make('member', { isMember: true })).id)
    await make('other', { isMember: true })
    await make('free', {})
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('records a term with the name as it is now, without changing board access', async () => {
    const res = await record({ userId: ids.member, role: 'TREASURER', termStart: iso(-10) })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      userId: ids.member,
      displayName: 'Term member',
      role: 'TREASURER',
      termEnd: null,
      endReason: null,
    })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ids.member! } })).isBoard).toBe(
      false,
    )
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'BOARD_TERM_RECORD', targetId: res.json().id },
    })
    expect(audit?.meta).toMatchObject({ role: 'TREASURER', displayName: 'Term member' })
  })

  it('allows one chair at a time and one role per member at a time', async () => {
    expect(
      (await record({ userId: ids.board, role: 'CHAIR', termStart: iso(-5), termEnd: iso(360) }))
        .statusCode,
    ).toBe(201)
    expect(
      (await record({ userId: ids.other, role: 'CHAIR', termStart: iso(100) })).statusCode,
    ).toBe(409)
    // The next chair can start when this term ends.
    expect(
      (await record({ userId: ids.other, role: 'CHAIR', termStart: iso(360) })).statusCode,
    ).toBe(201)
    expect(
      (await record({ userId: ids.member, role: 'SECRETARY', termStart: iso(0) })).statusCode,
    ).toBe(409)
  })

  it('checks who is recorded and who records', async () => {
    expect((await record({ userId: ids.free, role: 'MEMBER', termStart: iso(0) })).statusCode).toBe(
      400,
    )
    expect(
      (await record({ userId: 'missing-user', role: 'MEMBER', termStart: iso(0) })).statusCode,
    ).toBe(400)
    expect(
      (await record({ userId: ids.other, role: 'MEMBER', termStart: iso(0), termEnd: iso(-1) }))
        .statusCode,
    ).toBe(400)
    expect(
      (await record({ userId: ids.other, role: 'MEMBER', termStart: iso(0) }, memberCookie))
        .statusCode,
    ).toBe(403)
    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/governance/board-terms',
      headers: { cookie: boardCookie },
    })
    expect(list.statusCode).toBe(200)
  })

  it('shows members the board as it stands today, chair first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/board',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(200)
    const board = (res.json() as Array<{ displayName: string; role: string; username: string }>)
      .filter((t) => t.displayName.startsWith('Term '))
      .map((t) => [t.role, t.displayName, t.username])
    // The chair whose term starts in a year is not shown yet.
    expect(board).toEqual([
      ['CHAIR', 'Term board', 'governance-boardterm-board'],
      ['TREASURER', 'Term member', 'governance-boardterm-member'],
    ])
  })
})
