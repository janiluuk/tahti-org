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
  it('reorders the whole agenda and refuses a partial or foreign list', async () => {
    const items = await list()
    const reversed = items.map((item) => item.id).reverse()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/governance/meetings/${meetingId}/agenda-items/order`,
      headers: { cookie: boardCookie },
      payload: { ids: reversed },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((item: { id: string }) => item.id)).toEqual(reversed)
    expect(res.json().map((item: { position: number }) => item.position)).toEqual(
      items.map((_, index) => index + 1),
    )
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AGENDA_ITEM_REORDER', targetId: meetingId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit?.meta).toMatchObject({ order: reversed })

    for (const ids of [reversed.slice(1), [...reversed.slice(1), 'cforeignitem000000000000']]) {
      const bad = await app.inject({
        method: 'PUT',
        url: `/api/admin/governance/meetings/${meetingId}/agenda-items/order`,
        headers: { cookie: boardCookie },
        payload: { ids },
      })
      expect(bad.statusCode).toBe(400)
    }
  })

  it('removes an item and closes the gap in the numbering', async () => {
    const items = await list()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/governance/agenda-items/${items[1]!.id}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(204)
    const after = await list()
    expect(after.map((item) => item.id)).toEqual(
      items.filter((_, index) => index !== 1).map((item) => item.id),
    )
    expect(after.map((item) => item.position)).toEqual(after.map((_, index) => index + 1))
    expect(
      await prisma.auditLog.count({
        where: { action: 'AGENDA_ITEM_REMOVE', targetId: items[1]!.id },
      }),
    ).toBe(1)
  })

  it('fixes the agenda once the minutes are approved', async () => {
    const meeting = await prisma.governanceMeeting.create({
      data: {
        title: 'Agenda test approved meeting',
        type: 'BOARD',
        state: 'HELD',
        scheduledAt: new Date(),
        createdById: boardId,
      },
    })
    const item = await add({ title: 'Approved item' }, boardCookie, meeting.id)
    expect(item.statusCode).toBe(201)
    await prisma.governanceMeeting.update({
      where: { id: meeting.id },
      data: { minutesApprovedAt: new Date() },
    })
    expect((await add({ title: 'Late addition' }, boardCookie, meeting.id)).statusCode).toBe(409)
    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/agenda-items/${item.json().id}`,
      headers: { cookie: boardCookie },
      payload: { title: 'Rewritten' },
    })
    expect(edit.statusCode).toBe(409)
    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/admin/governance/agenda-items/${item.json().id}`,
      headers: { cookie: boardCookie },
    })
    expect(remove.statusCode).toBe(409)
  })
})
