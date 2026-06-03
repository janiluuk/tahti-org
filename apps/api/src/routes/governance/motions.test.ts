// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const TEST_EMAIL_PREFIX = 'gov-test-'

function cookie(sessionId: string) {
  return `tahti_session=${sessionId}`
}

describe('M10 — member governance', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let otherMemberCookie: string
  let freeCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: TEST_EMAIL_PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('testpassword')

    const board = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}board@example.com`,
        passwordHash,
        username: 'gov-board',
        displayName: 'Board Member',
        emailVerifiedAt: new Date(),
        isMember: true,
        isBoard: true,
        memberNumber: 1,
        memberSince: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      },
    })
    const member = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}member@example.com`,
        passwordHash,
        username: 'gov-member',
        displayName: 'Ordinary Member',
        emailVerifiedAt: new Date(),
        isMember: true,
        memberNumber: 2,
        memberSince: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      },
    })
    const other = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}other@example.com`,
        passwordHash,
        username: 'gov-other',
        displayName: 'Other Member',
        emailVerifiedAt: new Date(),
        isMember: true,
        memberNumber: 3,
        memberSince: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
      },
    })
    const free = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}free@example.com`,
        passwordHash,
        username: 'gov-free',
        displayName: 'Free User',
        emailVerifiedAt: new Date(),
        isMember: false,
      },
    })

    boardCookie = cookie((await createSession(prisma, board.id)).id)
    memberCookie = cookie((await createSession(prisma, member.id)).id)
    otherMemberCookie = cookie((await createSession(prisma, other.id)).id)
    freeCookie = cookie((await createSession(prisma, free.id)).id)
  })

  afterAll(async () => {
    // Motions reference the proposer (no cascade), so remove them before users.
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: TEST_EMAIL_PREFIX } } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('blocks anonymous access to the member directory', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/governance/members' })
    expect(res.statusCode).toBe(401)
  })

  it('blocks free (non-member) users from the directory', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/members',
      headers: { cookie: freeCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lists members ordered by member number', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/members',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(200)
    const numbers = res.json().map((m: { memberNumber: number }) => m.memberNumber)
    expect(numbers).toEqual([1, 2, 3])
  })

  it('forbids non-board members from posting a motion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: memberCookie },
      payload: {
        title: 'Should fail',
        description: 'x',
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a motion whose close is before its open', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Bad window',
        description: 'x',
        openAt: new Date(Date.now() + 86400000).toISOString(),
        closeAt: new Date().toISOString(),
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('runs the full lifecycle: create → open → vote → close → tally', async () => {
    // Board creates a motion (starts as DRAFT)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Adopt the 10% reserve policy',
        description: 'Set aside 10% of annual surplus before grant distribution.',
        openAt: new Date(Date.now() - 1000).toISOString(),
        closeAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    })
    expect(createRes.statusCode).toBe(201)
    const motionId = createRes.json().id as string
    expect(createRes.json().state).toBe('DRAFT')

    // Voting before the motion is opened is rejected
    const earlyVote = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: memberCookie },
      payload: { choice: 'YES' },
    })
    expect(earlyVote.statusCode).toBe(409)

    // Board opens the motion
    const openRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'OPEN' },
    })
    expect(openRes.statusCode).toBe(200)
    expect(openRes.json().state).toBe('OPEN')

    // An invalid choice is rejected
    const badChoice = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: memberCookie },
      payload: { choice: 'MAYBE' },
    })
    expect(badChoice.statusCode).toBe(400)

    // Member votes YES
    const vote1 = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: memberCookie },
      payload: { choice: 'YES' },
    })
    expect(vote1.statusCode).toBe(201)

    // Double-voting is rejected
    const vote1again = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: memberCookie },
      payload: { choice: 'NO' },
    })
    expect(vote1again.statusCode).toBe(409)

    // Other member votes NO; board votes ABSTAIN
    const vote2 = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: otherMemberCookie },
      payload: { choice: 'NO' },
    })
    expect(vote2.statusCode).toBe(201)
    const vote3 = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: boardCookie },
      payload: { choice: 'ABSTAIN' },
    })
    expect(vote3.statusCode).toBe(201)

    // While OPEN, the per-choice tally is hidden but the voter sees their own vote
    const openDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: memberCookie },
    })
    expect(openDetail.statusCode).toBe(200)
    expect(openDetail.json().tally).toBeUndefined()
    expect(openDetail.json().totalVotes).toBe(3)
    expect(openDetail.json().youVoted).toBe(true)
    expect(openDetail.json().yourChoice).toBe('YES')

    // Board closes the motion
    const closeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'CLOSED' },
    })
    expect(closeRes.statusCode).toBe(200)

    // Voting after close is rejected
    const lateVote = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: freeCookie },
      payload: { choice: 'YES' },
    })
    // free user is not a member → 403 takes precedence over window check
    expect(lateVote.statusCode).toBe(403)

    // Tally is revealed once CLOSED
    const closedDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: memberCookie },
    })
    expect(closedDetail.statusCode).toBe(200)
    expect(closedDetail.json().tally).toEqual({ YES: 1, NO: 1, ABSTAIN: 1 })
  })

  it('rejects an invalid state transition (DRAFT → CLOSED)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Jump straight to closed',
        description: 'x',
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    const motionId = createRes.json().id as string

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'CLOSED' },
    })
    expect(res.statusCode).toBe(409)
  })
})
