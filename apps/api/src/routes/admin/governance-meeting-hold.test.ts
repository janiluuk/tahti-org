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

const PREFIX = 'governance-meetinghold-test-'

describe('legal hold on a meeting record', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let meetingId: string
  let itemId: string

  async function cleanup() {
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Hold test ' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function call(method: 'PUT' | 'DELETE' | 'PATCH' | 'POST', url: string, payload?: unknown) {
    return app.inject({
      method,
      url,
      headers: { cookie: boardCookie },
      ...(payload ? { payload: payload as Record<string, unknown> } : {}),
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-meetinghold-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-meetinghold-member',
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
    meetingId = (
      await prisma.governanceMeeting.create({
        data: {
          title: 'Hold test general meeting',
          type: 'GENERAL',
          state: 'HELD',
          scheduledAt: new Date(),
          createdById: board.id,
        },
      })
    ).id
    itemId = (
      await prisma.governanceAgendaItem.create({
        data: { meetingId, position: 1, title: 'Opening' },
      })
    ).id
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('freezes the meeting record while held', async () => {
    const base = `/api/admin/governance/meetings/${meetingId}`
    expect((await call('PUT', `${base}/legal-hold`, { reason: '' })).statusCode).toBe(400)
    const held = await call('PUT', `${base}/legal-hold`, { reason: 'Election disputed' })
    expect(held.statusCode).toBe(200)
    expect(held.json()).toMatchObject({ id: meetingId, legalHoldReason: 'Election disputed' })

    const blocked = [
      await call('PATCH', base, { chairName: 'Someone else' }),
      await call('POST', `${base}/minutes/prepare-upload`, {
        contentType: 'application/pdf',
        fileSizeBytes: 1000,
      }),
      await call('POST', `${base}/attendance`, { displayName: 'Late arrival', status: 'PRESENT' }),
      await call('POST', `${base}/conflicts`, { displayName: 'A member', matter: 'Own grant' }),
      await call('POST', `${base}/agenda-items`, { title: 'Added afterwards' }),
      await call('PATCH', `/api/admin/governance/agenda-items/${itemId}`, { title: 'Renamed' }),
    ]
    expect(blocked.map((res) => res.statusCode)).toEqual([409, 409, 409, 409, 409, 409])

    // Members see that the record is held, not why.
    const members = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/meetings',
      headers: { cookie: memberCookie },
    })
    const row = (
      members.json() as Array<{
        id: string
        legalHoldAt: string | null
        legalHoldReason: string | null
      }>
    ).find((meeting) => meeting.id === meetingId)
    expect(row?.legalHoldAt).toBeTruthy()
    expect(row?.legalHoldReason).toBeNull()

    const lifted = await call('DELETE', `${base}/legal-hold`)
    expect(lifted.json()).toMatchObject({ legalHoldAt: null, legalHoldReason: null })
    expect((await call('PATCH', base, { chairName: 'Someone else' })).statusCode).toBe(200)

    const audits = await prisma.auditLog.findMany({
      where: { action: 'MEETING_LEGAL_HOLD', targetId: meetingId },
      orderBy: { createdAt: 'asc' },
    })
    expect(audits.map((audit) => (audit.meta as { held: boolean }).held)).toEqual([true, false])
  })

  it('is for the board only', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/governance/meetings/${meetingId}/legal-hold`,
      headers: { cookie: memberCookie },
      payload: { reason: 'x' },
    })
    expect(res.statusCode).toBe(403)
  })
})
