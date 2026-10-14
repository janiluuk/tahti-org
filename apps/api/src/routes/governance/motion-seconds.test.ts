// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-second-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe('seconding a motion draft', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let proposerCookie: string
  let memberCookie: string
  let freeCookie: string
  let motionId: string

  async function cleanup() {
    await prisma.notification.deleteMany({
      where: { type: 'MOTION_CIRCULATED', body: { contains: '"Second circulated' } },
    })
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97400, lte: 97499 } } })
  }

  function second(method: 'POST' | 'DELETE', who: string, id = motionId) {
    return app.inject({
      method,
      url: `/api/v1/governance/motions/${id}/second`,
      headers: { cookie: who },
    })
  }

  async function detail(who: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: who },
    })
    return res.json() as { secondCount: number; youSeconded: boolean }
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const passwordHash = await hashPassword('testpassword')
    const base = { passwordHash, emailVerifiedAt: new Date() }
    const make = (name: string, memberNumber: number | null, isBoard = false) =>
      prisma.user.create({
        data: {
          ...base,
          email: `${PREFIX}${name}@example.com`,
          username: `gov-second-${name}`,
          displayName: `Second ${name}`,
          isMember: memberNumber !== null,
          isBoard,
          memberNumber,
          memberSince: memberNumber !== null ? new Date() : null,
        },
      })
    const board = await make('board', 97401, true)
    const proposer = await make('proposer', 97402)
    const member = await make('member', 97403)
    const free = await make('free', null)
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    proposerCookie = cookie((await createSession(prisma, proposer.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
    freeCookie = cookie((await createSession(prisma, free.id)).id)

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: proposerCookie },
      payload: {
        title: 'Seconded proposal',
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

  it('is members only', async () => {
    expect((await second('POST', freeCookie)).statusCode).toBe(403)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/governance/motions/${motionId}/second`,
        })
      ).statusCode,
    ).toBe(401)
  })

  it('does not let the proposer second their own motion', async () => {
    const res = await second('POST', proposerCookie)
    expect(res.statusCode).toBe(409)
    expect((await detail(proposerCookie)).secondCount).toBe(0)
  })

  it('records one second per member and shows it on the motion', async () => {
    const first = await second('POST', memberCookie)
    expect(first.statusCode).toBe(201)
    expect(first.json()).toEqual({ ok: true, secondCount: 1 })

    const again = await second('POST', memberCookie)
    expect(again.statusCode).toBe(200)
    expect(again.json().secondCount).toBe(1)

    expect(await detail(memberCookie)).toMatchObject({ secondCount: 1, youSeconded: true })
    expect(await detail(boardCookie)).toMatchObject({ secondCount: 1, youSeconded: false })

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/motions?state=DRAFT',
      headers: { cookie: memberCookie },
    })
    const row = (
      list.json() as Array<{ id: string; secondCount: number; youSeconded: boolean }>
    ).find((m) => m.id === motionId)
    expect(row).toMatchObject({ secondCount: 1, youSeconded: true })
  })

  it('tells the proposer once when their draft is seconded', async () => {
    const proposer = await prisma.user.findUniqueOrThrow({
      where: { email: `${PREFIX}proposer@example.com` },
    })
    const notes = await prisma.notification.findMany({
      where: { userId: proposer.id, type: 'MOTION_SECONDED' },
    })
    // The member seconded twice above; only the first one is news.
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      title: 'Your motion was seconded',
      url: `/governance/motions/${motionId}`,
    })
    expect(notes[0]!.body).toContain('Seconded proposal')
  })

  it('lets a member withdraw their second while the motion is a draft', async () => {
    const res = await second('DELETE', memberCookie)
    expect(res.statusCode).toBe(200)
    expect(res.json().secondCount).toBe(0)
    expect((await second('DELETE', memberCookie)).statusCode).toBe(404)
  })

  it('keeps the seconds and refuses changes once the motion is open', async () => {
    expect((await second('POST', boardCookie)).statusCode).toBe(201)
    const opened = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'OPEN' },
    })
    expect(opened.statusCode).toBe(200)

    expect((await second('POST', memberCookie)).statusCode).toBe(409)
    expect((await second('DELETE', boardCookie)).statusCode).toBe(409)
    expect((await detail(memberCookie)).secondCount).toBe(1)
  })

  it('lists who seconded, for members only', async () => {
    const url = `/api/v1/governance/motions/${motionId}/seconds`
    const res = await app.inject({ method: 'GET', url, headers: { cookie: memberCookie } })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ displayName: string; username: string; secondedAt: string }>
    // The member withdrew; the board member seconded before the motion opened.
    expect(rows.map((r) => r.username)).toEqual(['gov-second-board'])
    expect(rows[0]!.displayName).toBe('Second board')
    expect(Number.isNaN(Date.parse(rows[0]!.secondedAt))).toBe(false)

    expect(
      (await app.inject({ method: 'GET', url, headers: { cookie: freeCookie } })).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/governance/motions/missing-motion/seconds',
          headers: { cookie: memberCookie },
        })
      ).statusCode,
    ).toBe(404)
  })

  it('lets the board circulate a draft once, telling the members', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: proposerCookie },
      payload: {
        title: 'Second circulated proposal',
        description: 'Details',
        openAt: new Date(Date.now() + 86400000).toISOString(),
        closeAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
    })
    const id = created.json().id as string
    const circulate = (who: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/governance/motions/${id}/circulate`,
        headers: { cookie: who },
      })
    expect((await circulate(memberCookie)).statusCode).toBe(403)
    const res = await circulate(boardCookie)
    expect(res.statusCode).toBe(200)
    expect(res.json().notified).toBeGreaterThanOrEqual(2)
    const told = await prisma.notification.findMany({
      where: { type: 'MOTION_CIRCULATED', url: `/governance/motions/${id}` },
      select: { user: { select: { username: true } } },
    })
    const usernames = told.map((row) => row.user.username)
    expect(usernames).toEqual(expect.arrayContaining(['gov-second-proposer', 'gov-second-member']))
    expect(usernames).not.toContain('gov-second-board')
    expect(usernames).not.toContain('gov-second-free')
    expect(
      await prisma.auditLog.count({ where: { action: 'MOTION_CIRCULATE', targetId: id } }),
    ).toBe(1)

    const shown = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${id}`,
      headers: { cookie: memberCookie },
    })
    expect(shown.json().circulatedAt).toBe(res.json().circulatedAt)
    expect((await circulate(boardCookie)).statusCode).toBe(409)

    await prisma.motion.update({ where: { id }, data: { state: 'OPEN', circulatedAt: null } })
    expect((await circulate(boardCookie)).statusCode).toBe(409)
  })

  it('answers 404 for a motion that does not exist', async () => {
    expect((await second('POST', memberCookie, 'missing-motion')).statusCode).toBe(404)
  })
})
