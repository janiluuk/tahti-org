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

const PREFIX = 'governance-agenda-test-'

describe('meeting agenda items', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let boardId: string
  let meetingId: string

  async function cleanup() {
    await prisma.governanceMeeting.deleteMany({
      where: { title: { startsWith: 'Agenda test ' } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function add(payload: Record<string, unknown>, who = boardCookie, id = meetingId) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${id}/agenda-items`,
      headers: { cookie: who },
      payload,
    })
  }

  async function list(id = meetingId) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/governance/meetings/${id}/agenda-items`,
      headers: { cookie: boardCookie },
    })
    return res.json() as Array<{ id: string; position: number; title: string }>
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-agenda-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-agenda-member',
      isMember: true,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
    meetingId = (
      await prisma.governanceMeeting.create({
        data: {
          title: 'Agenda test general meeting',
          type: 'GENERAL',
          state: 'SCHEDULED',
          scheduledAt: new Date(),
          createdById: boardId,
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('adds items at the end of the agenda, in order', async () => {
    const first = await add({ title: 'Opening of the meeting' })
    expect(first.statusCode).toBe(201)
    expect(first.json()).toMatchObject({ meetingId, position: 1, description: null })
    const second = await add({ title: 'Election of the board', description: 'Three seats' })
    expect(second.json()).toMatchObject({ position: 2, description: 'Three seats' })
    expect((await list()).map((item) => item.title)).toEqual([
      'Opening of the meeting',
      'Election of the board',
    ])
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AGENDA_ITEM_CREATE', targetId: second.json().id },
    })
    expect(audit?.meta).toMatchObject({ meetingId, position: 2, title: 'Election of the board' })
  })

  it('gives items added at the same time distinct positions', async () => {
    const before = (await list()).length
    await Promise.all([add({ title: 'Parallel A' }), add({ title: 'Parallel B' })])
    const positions = (await list()).map((item) => item.position)
    expect(new Set(positions).size).toBe(before + 2)
  })

  it('edits an item and audits only what changed', async () => {
    const [item] = await list()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/agenda-items/${item!.id}`,
      headers: { cookie: boardCookie },
      payload: { title: 'Opening and quorum', description: 'Chair opens the meeting' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ title: 'Opening and quorum', position: 1 })
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AGENDA_ITEM_UPDATE', targetId: item!.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit?.meta).toMatchObject({ changed: ['title', 'description'] })

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/agenda-items/${item!.id}`,
      headers: { cookie: boardCookie },
      payload: { description: null },
    })
    expect(cleared.json().description).toBeNull()
  })

  it('rejects members, unknown meetings and empty edits', async () => {
    expect((await add({ title: 'Sneaky' }, memberCookie)).statusCode).toBe(403)
    expect(
      (await add({ title: 'Nowhere' }, boardCookie, 'cmissingmeeting00000000000')).statusCode,
    ).toBe(404)
    expect((await add({ title: '  ' })).statusCode).toBe(400)
    const [item] = await list()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/agenda-items/${item!.id}`,
      headers: { cookie: boardCookie },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
