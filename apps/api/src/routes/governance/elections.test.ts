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

const PREFIX = 'governance-election-test-'
const day = 86400000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

describe('board elections', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let meetingId: string
  const ids: Record<string, string> = {}

  async function cleanup() {
    await prisma.governanceElection.deleteMany({ where: { title: { startsWith: 'Election ' } } })
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Election ' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function setUp(payload: Record<string, unknown>, who = boardCookie) {
    return app.inject({
      method: 'POST',
      url: '/api/admin/governance/elections',
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
        username: `governance-election-${name}`,
        ...extra,
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { displayName: `Election ${name}` },
      })
      ids[name] = user.id
      return user
    }
    const board = await make('board', { isMember: true, isBoard: true })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, (await make('member', { isMember: true })).id)
    await make('other', { isMember: true })
    await make('free', {})
    meetingId = (
      await prisma.governanceMeeting.create({
        data: {
          title: 'Election annual general meeting',
          type: 'GENERAL',
          state: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 30 * day),
          createdById: board.id,
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  describe('setting up', () => {
    it('records the role, seats, meeting and nomination deadline', async () => {
      const res = await setUp({
        title: 'Election of board members 2027',
        role: 'MEMBER',
        seats: 3,
        meetingId,
        nominationsCloseAt: iso(20),
      })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ role: 'MEMBER', seats: 3, meetingId, decidedAt: null })
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ELECTION_CREATE', targetId: res.json().id },
      })
      expect(audit?.meta).toMatchObject({ role: 'MEMBER', seats: 3, meetingId })

      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/governance/elections',
        headers: { cookie: boardCookie },
      })
      expect((list.json() as Array<{ id: string }>).map((e) => e.id)).toContain(res.json().id)
    })

    it('elects one chair, and checks the meeting and who asks', async () => {
      expect(
        (await setUp({ title: 'Election of chair', role: 'CHAIR', seats: 2 })).statusCode,
      ).toBe(400)
      expect(
        (
          await setUp({
            title: 'Election nowhere',
            role: 'MEMBER',
            seats: 1,
            meetingId: 'cmissingmeeting00000000000',
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (await setUp({ title: 'Election by member', role: 'MEMBER', seats: 1 }, memberCookie))
          .statusCode,
      ).toBe(403)
    })
  })
  describe('candidates', () => {
    let electionId: string
    const candidates = async () =>
      (
        await app.inject({
          method: 'GET',
          url: `/api/admin/governance/elections/${electionId}/candidates`,
          headers: { cookie: boardCookie },
        })
      ).json() as Array<{
        userId: string
        displayName: string
        statement: string | null
        selfNominated: boolean
        withdrawnAt: string | null
      }>
    const stand = (payload: Record<string, unknown> = {}, id = electionId) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/governance/elections/${id}/candidacy`,
        headers: { cookie: memberCookie },
        payload,
      })
    const withdraw = () =>
      app.inject({
        method: 'DELETE',
        url: `/api/v1/governance/elections/${electionId}/candidacy`,
        headers: { cookie: memberCookie },
      })
    const nominate = (userId: string) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/governance/elections/${electionId}/candidates`,
        headers: { cookie: boardCookie },
        payload: { userId },
      })

    beforeAll(async () => {
      electionId = (
        await setUp({
          title: 'Election of the treasurer',
          role: 'TREASURER',
          seats: 1,
          nominationsCloseAt: iso(10),
        })
      ).json().id
    })

    it('lets a member stand with a statement, and withdraw', async () => {
      const res = await stand({ statement: 'I keep the books.' })
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({
        userId: ids.member,
        displayName: 'Election member',
        statement: 'I keep the books.',
        selfNominated: true,
        withdrawnAt: null,
      })
      expect((await withdraw()).statusCode).toBe(204)
      expect((await candidates()).find((c) => c.userId === ids.member)?.withdrawnAt).toBeTruthy()

      // Standing again brings the same candidacy back.
      await stand()
      const again = (await candidates()).filter((c) => c.userId === ids.member)
      expect(again).toHaveLength(1)
      expect(again[0]!.withdrawnAt).toBeNull()

      const audits = await prisma.auditLog.findMany({
        where: { action: { in: ['ELECTION_NOMINATE', 'ELECTION_WITHDRAW'] }, targetId: electionId },
        orderBy: { createdAt: 'asc' },
      })
      expect(audits.map((a) => a.action)).toEqual([
        'ELECTION_NOMINATE',
        'ELECTION_WITHDRAW',
        'ELECTION_NOMINATE',
      ])
    })

    it('lets the board nominate members only', async () => {
      const res = await nominate(ids.other!)
      expect(res.statusCode).toBe(201)
      expect(res.json()).toMatchObject({ displayName: 'Election other', selfNominated: false })
      expect((await nominate(ids.free!)).statusCode).toBe(400)
    })

    it('closes self-nomination at the deadline; the board can still nominate', async () => {
      await prisma.governanceElection.update({
        where: { id: electionId },
        data: { nominationsCloseAt: new Date(Date.now() - 1000) },
      })
      await withdraw()
      expect((await stand()).statusCode).toBe(409)
      expect((await nominate(ids.member!)).statusCode).toBe(201)
    })

    it('freezes the candidates once the result is recorded', async () => {
      await prisma.governanceElection.update({
        where: { id: electionId },
        data: { decidedAt: new Date() },
      })
      expect((await nominate(ids.other!)).statusCode).toBe(409)
      expect((await withdraw()).statusCode).toBe(409)
      expect((await stand({}, 'cmissingelection0000000000')).statusCode).toBe(404)
    })
  })
})
