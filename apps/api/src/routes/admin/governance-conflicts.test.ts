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

const PREFIX = 'governance-conflicts-test-'

describe('conflict-of-interest declarations', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string

  async function cleanup() {
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Conflicts ' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  async function meeting(title: string) {
    return prisma.governanceMeeting.create({
      data: {
        title,
        type: 'BOARD',
        state: 'HELD',
        scheduledAt: new Date(),
        createdById: boardId,
      },
    })
  }

  function declare(meetingId: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meetingId}/conflicts`,
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
      username: 'governance-conflicts-board',
      isMember: true,
      isBoard: true,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('names the agenda item a conflict concerns, on the same meeting only', async () => {
    const held = await meeting('Conflicts board meeting')
    const other = await meeting('Conflicts other meeting')
    const item = await prisma.governanceAgendaItem.create({
      data: { meetingId: held.id, position: 1, title: 'Venue contract' },
    })
    const res = await declare(held.id, {
      displayName: 'Board member Y',
      matter: 'Owns the venue',
      agendaItemId: item.id,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ agendaItemId: item.id, recused: true })
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CONFLICT_DECLARE', targetId: held.id },
    })
    expect(audit?.meta).toMatchObject({ agendaItemId: item.id })

    const wrong = await declare(other.id, {
      displayName: 'Board member Y',
      matter: 'Owns the venue',
      agendaItemId: item.id,
    })
    expect(wrong.statusCode).toBe(400)

    // The item now has a record on it, so it cannot be removed.
    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/admin/governance/agenda-items/${item.id}`,
      headers: { cookie: boardCookie },
    })
    expect(remove.statusCode).toBe(409)
  })
})
