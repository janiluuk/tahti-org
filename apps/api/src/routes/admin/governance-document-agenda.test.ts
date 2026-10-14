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

const PREFIX = 'governance-docagenda-test-'

describe('governance documents on an agenda item', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string
  let springId: string
  let autumnId: string
  let itemId: string

  async function cleanup() {
    await prisma.governanceDocument.deleteMany({ where: { title: { startsWith: 'Docagenda ' } } })
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Docagenda ' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function create(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/admin/governance/documents',
      headers: { cookie: boardCookie },
      payload: { title: 'Docagenda budget proposal', type: 'OTHER', ...payload },
    })
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/documents/${id}`,
      headers: { cookie: boardCookie },
      payload,
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-docagenda-board',
      isMember: true,
      isBoard: true,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    const meeting = (title: string) =>
      prisma.governanceMeeting.create({
        data: { title, type: 'GENERAL', state: 'SCHEDULED', createdById: boardId },
      })
    springId = (await meeting('Docagenda spring meeting')).id
    autumnId = (await meeting('Docagenda autumn meeting')).id
    itemId = (
      await prisma.governanceAgendaItem.create({
        data: { meetingId: springId, position: 1, title: 'Budget' },
      })
    ).id
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('takes the meeting from the agenda item it is filed under', async () => {
    const res = await create({ agendaItemId: itemId })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ meetingId: springId, agendaItemId: itemId })
    expect((await create({ agendaItemId: itemId, meetingId: autumnId })).statusCode).toBe(400)
    expect((await create({ agendaItemId: 'missing-item' })).statusCode).toBe(400)

    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/admin/governance/agenda-items/${itemId}`,
      headers: { cookie: boardCookie },
    })
    expect(remove.statusCode).toBe(409)
  })

  it('files an existing document under an item, and drops it on a move to another meeting', async () => {
    const document = (await create({})).json() as { id: string }
    const filed = await patch(document.id, { agendaItemId: itemId })
    expect(filed.json()).toMatchObject({ meetingId: springId, agendaItemId: itemId })
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DOCUMENT_UPDATE', targetId: document.id },
      orderBy: { createdAt: 'desc' },
    })
    expect((audit?.meta as { changed: string[] }).changed.sort()).toEqual([
      'agendaItemId',
      'meetingId',
    ])

    const moved = await patch(document.id, { meetingId: autumnId })
    expect(moved.json()).toMatchObject({ meetingId: autumnId, agendaItemId: null })
  })
})
