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
    await prisma.notification.deleteMany({
      where: {
        type: { in: ['ELECTION_OPENED', 'ELECTION_RESULT'] },
        body: { contains: '"Election ' },
      },
    })
    await prisma.governanceBoardTerm.deleteMany({
      where: { displayName: { startsWith: 'Election ' } },
    })
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

    it('tells the other members when nominations open, and not for a closed deadline', async () => {
      const told = (electionTitle: string) =>
        prisma.notification.findMany({
          where: { type: 'ELECTION_OPENED', body: { contains: electionTitle } },
          select: { userId: true, body: true, url: true },
        })
      await setUp({
        title: 'Election announced to members',
        role: 'DEPUTY',
        seats: 2,
        nominationsCloseAt: '2099-01-31T00:00:00.000Z',
      })
      const rows = await told('Election announced to members')
      const userIds = rows.map((row) => row.userId)
      expect(userIds).toEqual(expect.arrayContaining([ids.member, ids.other]))
      expect(userIds).not.toContain(ids.board)
      expect(userIds).not.toContain(ids.free)
      expect(rows[0]).toMatchObject({ url: '/governance/elections' })
      expect(rows[0]!.body).toContain('until 2099-01-31')

      await setUp({
        title: 'Election past its deadline',
        role: 'DEPUTY',
        seats: 1,
        nominationsCloseAt: iso(-1),
      })
      expect(await told('Election past its deadline')).toHaveLength(0)
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

    it('edits the details until the result is recorded, and audits what changed', async () => {
      const edit = (id: string, payload: Record<string, unknown>) =>
        app.inject({
          method: 'PATCH',
          url: `/api/admin/governance/elections/${id}`,
          headers: { cookie: boardCookie },
          payload,
        })
      const id = (
        await setUp({ title: 'Election to be edited', role: 'VICE_CHAIR', seats: 1, meetingId })
      ).json().id
      const res = await edit(id, {
        title: 'Election of the vice chair',
        seats: 2,
        meetingId: null,
        nominationsCloseAt: iso(5),
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ title: 'Election of the vice chair', seats: 2 })
      expect(res.json().meetingId).toBeNull()
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ELECTION_UPDATE', targetId: id },
      })
      expect((audit?.meta as { changed: string[] }).changed.sort()).toEqual([
        'meetingId',
        'nominationsCloseAt',
        'seats',
        'title',
      ])

      expect((await edit(id, {})).statusCode).toBe(400)
      expect((await edit(id, { meetingId: 'cmissingmeeting00000000000' })).statusCode).toBe(400)
      const chair = (await setUp({ title: 'Election chair edit', role: 'CHAIR', seats: 1 })).json()
      expect((await edit(chair.id, { seats: 2 })).statusCode).toBe(400)

      await prisma.governanceElection.update({ where: { id }, data: { decidedAt: new Date() } })
      expect((await edit(id, { title: 'Election rewritten' })).statusCode).toBe(409)
      expect((await edit('cmissingelection0000000000', { seats: 1 })).statusCode).toBe(404)
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
  describe('result', () => {
    let electionId: string
    const record = (payload: Record<string, unknown>, id = electionId) =>
      app.inject({
        method: 'POST',
        url: `/api/admin/governance/elections/${id}/result`,
        headers: { cookie: boardCookie },
        payload,
      })

    beforeAll(async () => {
      electionId = (
        await setUp({ title: 'Election of two members', role: 'MEMBER', seats: 2, meetingId })
      ).json().id
      for (const name of ['member', 'other', 'board']) {
        await app.inject({
          method: 'POST',
          url: `/api/admin/governance/elections/${electionId}/candidates`,
          headers: { cookie: boardCookie },
          payload: { userId: ids[name] },
        })
      }
    })

    it('checks the seats and that everyone elected is standing', async () => {
      expect(
        (await record({ electedUserIds: [ids.member, ids.other, ids.board], termStart: iso(30) }))
          .statusCode,
      ).toBe(400)
      expect((await record({ electedUserIds: [ids.free], termStart: iso(30) })).statusCode).toBe(
        400,
      )
    })

    it('refuses a result that would overlap a term the member already holds, and changes nothing', async () => {
      await prisma.governanceBoardTerm.create({
        data: {
          userId: ids.board,
          displayName: 'Election board',
          role: 'SECRETARY',
          termStart: new Date(Date.now() - day),
        },
      })
      const res = await record({ electedUserIds: [ids.member, ids.board], termStart: iso(30) })
      expect(res.statusCode).toBe(409)
      expect(
        await prisma.governanceBoardTerm.count({ where: { userId: ids.member, role: 'MEMBER' } }),
      ).toBe(0)
      const election = await prisma.governanceElection.findUniqueOrThrow({
        where: { id: electionId },
      })
      expect(election.decidedAt).toBeNull()
    })

    it('records who was elected and gives each a term from the electing meeting', async () => {
      const res = await record({
        electedUserIds: [ids.member, ids.other],
        termStart: iso(30),
        termEnd: iso(30 + 730),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.election.decidedAt).toBeTruthy()
      expect(
        (body.candidates as Array<{ userId: string; elected: boolean }>)
          .filter((c) => c.elected)
          .map((c) => c.userId)
          .sort(),
      ).toEqual([ids.member, ids.other].sort())
      expect(body.terms).toHaveLength(2)
      expect(body.terms[0]).toMatchObject({ role: 'MEMBER', meetingId })

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ELECTION_DECIDE', targetId: electionId },
      })
      expect((audit?.meta as { elected: string[] }).elected.sort()).toEqual([
        'Election member',
        'Election other',
      ])
      expect(
        await prisma.auditLog.count({
          where: {
            action: 'BOARD_TERM_RECORD',
            targetId: { in: body.terms.map((t: { id: string }) => t.id) },
          },
        }),
      ).toBe(2)

      expect((await record({ electedUserIds: [ids.member], termStart: iso(30) })).statusCode).toBe(
        409,
      )

      const told = await prisma.notification.findMany({
        where: { type: 'ELECTION_RESULT', body: { contains: '"Election of two members"' } },
        select: { userId: true, title: true },
      })
      expect(told.map((row) => [row.userId, row.title]).sort()).toEqual(
        [
          [ids.board, 'An election you stood in is decided'],
          [ids.member, 'You were elected'],
          [ids.other, 'You were elected'],
        ].sort(),
      )
    })
  })
  describe('cancelling', () => {
    it('calls an election off with a reason, after which nothing changes', async () => {
      const id = (await setUp({ title: 'Election called off', role: 'SECRETARY', seats: 1 })).json()
        .id
      await app.inject({
        method: 'POST',
        url: `/api/v1/governance/elections/${id}/candidacy`,
        headers: { cookie: memberCookie },
        payload: {},
      })
      const cancel = (payload: Record<string, unknown>) =>
        app.inject({
          method: 'POST',
          url: `/api/admin/governance/elections/${id}/cancel`,
          headers: { cookie: boardCookie },
          payload,
        })
      expect((await cancel({ reason: ' ' })).statusCode).toBe(400)
      const res = await cancel({ reason: 'The secretary is chosen by the board' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ cancelReason: 'The secretary is chosen by the board' })
      expect(res.json().cancelledAt).toBeTruthy()
      expect((await cancel({ reason: 'Again' })).statusCode).toBe(409)
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ELECTION_CANCEL', targetId: id },
      })
      expect(audit?.meta).toMatchObject({ reason: 'The secretary is chosen by the board' })

      const refused = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/admin/governance/elections/${id}/candidates`,
          headers: { cookie: boardCookie },
          payload: { userId: ids.other },
        }),
        app.inject({
          method: 'DELETE',
          url: `/api/v1/governance/elections/${id}/candidacy`,
          headers: { cookie: memberCookie },
        }),
        app.inject({
          method: 'POST',
          url: `/api/admin/governance/elections/${id}/result`,
          headers: { cookie: boardCookie },
          payload: { electedUserIds: [ids.member], termStart: iso(30) },
        }),
        app.inject({
          method: 'PATCH',
          url: `/api/admin/governance/elections/${id}`,
          headers: { cookie: boardCookie },
          payload: { seats: 2 },
        }),
      ])
      expect(refused.map((r) => r.statusCode)).toEqual([409, 409, 409, 409])

      const members = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/elections',
        headers: { cookie: memberCookie },
      })
      expect(
        (members.json() as Array<{ id: string }>).find((election) => election.id === id),
      ).toMatchObject({
        nominationsOpen: false,
        cancelReason: 'The secretary is chosen by the board',
      })
    })
  })
  describe('member view', () => {
    it('lists elections with the candidates standing and the result', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/elections',
        headers: { cookie: memberCookie },
      })
      expect(res.statusCode).toBe(200)
      type Row = {
        title: string
        nominationsOpen: boolean
        youAreCandidate: boolean
        candidates: Array<{ displayName: string; username: string | null; elected: boolean }>
      }
      const rows = res.json() as Row[]
      const decided = rows.find((row) => row.title === 'Election of two members')!
      expect(decided.nominationsOpen).toBe(false)
      expect(decided.youAreCandidate).toBe(true)
      expect(decided.candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            displayName: 'Election member',
            username: 'governance-election-member',
            elected: true,
          }),
          expect.objectContaining({ displayName: 'Election board', elected: false }),
        ]),
      )
      expect(rows.find((row) => row.title === 'Election of board members 2027')).toMatchObject({
        nominationsOpen: true,
        youAreCandidate: false,
        candidates: [],
      })
    })

    it('leaves out withdrawn candidacies and is for members only', async () => {
      const electionId = (
        await setUp({ title: 'Election with a withdrawal', role: 'DEPUTY', seats: 1 })
      ).json().id
      await app.inject({
        method: 'POST',
        url: `/api/v1/governance/elections/${electionId}/candidacy`,
        headers: { cookie: memberCookie },
        payload: {},
      })
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/governance/elections/${electionId}/candidacy`,
        headers: { cookie: memberCookie },
      })
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/elections',
        headers: { cookie: memberCookie },
      })
      const row = (
        res.json() as Array<{ id: string; candidates: unknown[]; youAreCandidate: boolean }>
      ).find((election) => election.id === electionId)
      expect(row).toMatchObject({ candidates: [], youAreCandidate: false })

      const outsider = await app.inject({ method: 'GET', url: '/api/v1/governance/elections' })
      expect(outsider.statusCode).toBe(401)
    })
  })
})
