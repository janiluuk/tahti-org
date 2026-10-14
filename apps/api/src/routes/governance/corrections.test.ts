// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'gov-corr-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe('governance correction requests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberCookie: string
  let otherCookie: string
  let freeCookie: string
  let memberId: string

  async function cleanup() {
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Corr ' } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 97900, lte: 97999 } } })
  }

  function file(who: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/governance/corrections',
      headers: { cookie: who },
      payload,
    })
  }

  function mine(who: string) {
    return app.inject({
      method: 'GET',
      url: '/api/v1/governance/corrections',
      headers: { cookie: who },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const passwordHash = await hashPassword('testpassword')
    const make = (name: string, memberNumber: number | null) =>
      prisma.user.create({
        data: {
          passwordHash,
          emailVerifiedAt: new Date(),
          email: `${PREFIX}${name}@example.com`,
          username: `gov-corr-${name}`,
          displayName: `Corr ${name}`,
          isMember: memberNumber !== null,
          memberNumber,
          memberSince: memberNumber !== null ? new Date() : null,
        },
      })
    const member = await make('member', 97901)
    const other = await make('other', 97902)
    const free = await make('free', null)
    memberId = member.id
    memberCookie = cookie((await createSession(prisma, member.id)).id)
    otherCookie = cookie((await createSession(prisma, other.id)).id)
    freeCookie = cookie((await createSession(prisma, free.id)).id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('names a record the member can see, and refuses one they cannot', async () => {
    const passwordHash = await hashPassword('testpassword')
    const user = await prisma.user.create({
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        email: `${PREFIX}records@example.com`,
        username: 'gov-corr-records',
        displayName: 'Corr records',
        isMember: true,
        memberNumber: 97903,
        memberSince: new Date(),
      },
    })
    const who = cookie((await createSession(prisma, user.id)).id)
    const meeting = (state: 'DRAFT' | 'HELD') =>
      prisma.governanceMeeting.create({
        data: { title: `Corr ${state} meeting`, type: 'BOARD', state, createdById: memberId },
      })
    const held = await meeting('HELD')
    const draft = await meeting('DRAFT')
    const details = 'The attendance list leaves me out.'

    const res = await file(who, {
      subject: 'GOVERNANCE_RECORD',
      details,
      recordKind: 'MEETING',
      recordId: held.id,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ recordKind: 'MEETING', recordId: held.id })
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CORRECTION_REQUEST', targetId: res.json().id },
    })
    expect(audit?.meta).toMatchObject({ recordKind: 'MEETING', recordId: held.id })

    for (const payload of [
      { subject: 'GOVERNANCE_RECORD', details, recordKind: 'MEETING', recordId: draft.id },
      { subject: 'GOVERNANCE_RECORD', details, recordKind: 'RESOLUTION', recordId: 'abc' },
      { subject: 'GOVERNANCE_RECORD', details, recordKind: 'ANNUAL_REPORT', recordId: '1999' },
      { subject: 'GOVERNANCE_RECORD', details, recordKind: 'MEETING' },
      { subject: 'MEMBER_REGISTER', details, recordKind: 'MEETING', recordId: held.id },
    ]) {
      expect((await file(who, payload)).statusCode).toBe(400)
    }
    const plain = await file(who, { subject: 'GOVERNANCE_RECORD', details })
    expect(plain.json()).toMatchObject({ recordKind: null, recordId: null })
  })

  it('lets a member file a request and read it back', async () => {
    const res = await file(memberCookie, {
      subject: 'MEMBER_REGISTER',
      details: 'My joining date is shown as 2025, it was 2024.',
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({
      subject: 'MEMBER_REGISTER',
      details: 'My joining date is shown as 2025, it was 2024.',
      state: 'OPEN',
      resolutionNote: null,
      resolvedAt: null,
    })

    const list = (await mine(memberCookie)).json() as Array<{ id: string }>
    expect(list.map((r) => r.id)).toEqual([res.json().id])
  })

  it('shows a member only their own requests', async () => {
    expect((await mine(otherCookie)).json()).toEqual([])
  })

  it('keeps the request text out of the audit log', async () => {
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CORRECTION_REQUEST', actorId: memberId },
    })
    expect(audit?.meta).toEqual({ subject: 'MEMBER_REGISTER' })
  })

  it('is members only and checks the body', async () => {
    const body = { subject: 'GOVERNANCE_RECORD', details: 'The minutes list me as absent.' }
    expect((await file(freeCookie, body)).statusCode).toBe(403)
    expect((await mine(freeCookie)).statusCode).toBe(403)
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/governance/corrections' })).statusCode,
    ).toBe(401)
    expect((await file(memberCookie, { ...body, subject: 'SOMETHING_ELSE' })).statusCode).toBe(400)
    expect((await file(memberCookie, { ...body, details: 'too short' })).statusCode).toBe(400)
  })

  it('stops at five unanswered requests', async () => {
    const body = { subject: 'GOVERNANCE_RECORD', details: 'The minutes list me as absent.' }
    for (let i = 0; i < 4; i += 1) expect((await file(memberCookie, body)).statusCode).toBe(201)
    const sixth = await file(memberCookie, body)
    expect(sixth.statusCode).toBe(409)
    // An answered request makes room for a new one.
    const oldest = await prisma.governanceCorrectionRequest.findFirstOrThrow({
      where: { requesterId: memberId },
      orderBy: { createdAt: 'asc' },
    })
    await prisma.governanceCorrectionRequest.update({
      where: { id: oldest.id },
      data: { state: 'REJECTED' },
    })
    expect((await file(memberCookie, body)).statusCode).toBe(201)
  })
})
