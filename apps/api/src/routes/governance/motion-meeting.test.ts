// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-mlink-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe('linking a motion to a meeting', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let motionId: string
  let scheduledId: string
  let draftId: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await prisma.governanceMeeting.deleteMany({
      where: { createdBy: { email: { startsWith: PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97700, lte: 97799 } } })
  }

  function link(who: string, meetingId: string | null, id = motionId) {
    return app.inject({
      method: 'PUT',
      url: `/api/v1/governance/motions/${id}/meeting`,
      headers: { cookie: who },
      payload: { meetingId },
    })
  }

  async function detail(who: string) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: who },
    })
    return res.json() as { meeting: { id: string; title: string } | null }
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
          username: `gov-mlink-${name}`,
          displayName: `Link ${name}`,
          isMember: true,
          isBoard,
          memberNumber,
          memberSince: new Date(),
        },
      })
    const board = await make('board', 97701, true)
    const member = await make('member', 97702)
    boardCookie = cookie((await createSession(prisma, board.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)

    const meeting = (title: string, state: 'DRAFT' | 'SCHEDULED') =>
      prisma.governanceMeeting.create({
        data: { title, type: 'GENERAL', state, createdById: board.id, scheduledAt: new Date() },
      })
    scheduledId = (await meeting('Autumn general meeting', 'SCHEDULED')).id
    draftId = (await meeting('Unannounced meeting', 'DRAFT')).id

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: memberCookie },
      payload: {
        title: 'Agenda proposal',
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

  it('starts with no meeting', async () => {
    expect((await detail(memberCookie)).meeting).toBeNull()
  })

  it('is for the board only', async () => {
    expect((await link(memberCookie, scheduledId)).statusCode).toBe(403)
    expect((await detail(memberCookie)).meeting).toBeNull()
  })

  it('shows the linked meeting on the motion and records who linked it', async () => {
    const res = await link(boardCookie, scheduledId)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id: motionId,
      meeting: { id: scheduledId, title: 'Autumn general meeting' },
    })
    expect((await detail(memberCookie)).meeting).toMatchObject({
      id: scheduledId,
      title: 'Autumn general meeting',
    })

    // Linking the same meeting again is not a second audit entry.
    await link(boardCookie, scheduledId)
    const audits = await prisma.auditLog.findMany({
      where: { action: 'MOTION_MEETING_LINK', targetId: motionId },
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]!.meta).toMatchObject({ meetingId: scheduledId, previousMeetingId: null })
  })

  it('hides a meeting that is still a draft from members, not from the board', async () => {
    expect((await link(boardCookie, draftId)).statusCode).toBe(200)
    expect((await detail(memberCookie)).meeting).toBeNull()
    expect((await detail(boardCookie)).meeting).toMatchObject({ id: draftId })
  })

  it('can be unlinked, and refuses a meeting or motion that does not exist', async () => {
    const res = await link(boardCookie, null)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: motionId, meeting: null })
    expect((await detail(boardCookie)).meeting).toBeNull()

    expect((await link(boardCookie, 'missing-meeting')).statusCode).toBe(400)
    expect((await link(boardCookie, scheduledId, 'missing-motion')).statusCode).toBe(404)
  })

  it('keeps the motion when its meeting is deleted', async () => {
    await link(boardCookie, scheduledId)
    await prisma.governanceMeeting.delete({ where: { id: scheduledId } })
    expect((await detail(boardCookie)).meeting).toBeNull()
  })
})
