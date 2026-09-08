// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-res-'

describe('M21-G — board resolutions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string
  let resolutionId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-res-board',
    })
    boardId = board.id
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.boardResolution.deleteMany({})
    await prisma.governanceMeeting.deleteMany({ where: { createdById: boardId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/admin/resolutions creates draft, binding true by default', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Grant disbursement 2026',
        body: 'Approved unanimously.',
        votedAt: '2026-03-15T12:00:00.000Z',
        outcome: 'PASSED',
        voteFor: 3,
        voteAgainst: 0,
        voteAbstain: 0,
      },
    })
    expect(res.statusCode).toBe(201)
    resolutionId = (res.json() as { id: string }).id
    expect(resolutionId).toBeTruthy()
    expect(res.json().binding).toBe(true)
    expect(res.json().meetingId).toBeNull()
  })

  it('links a resolution to a meeting and marks it non-binding', async () => {
    const meeting = await prisma.governanceMeeting.create({
      data: { title: 'Board meeting for resolution link', type: 'BOARD', createdById: boardId },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Informational statement',
        body: 'Not a binding decision.',
        votedAt: '2026-03-15T12:00:00.000Z',
        outcome: 'PASSED',
        voteFor: 3,
        voteAgainst: 0,
        voteAbstain: 0,
        meetingId: meeting.id,
        binding: false,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().meetingId).toBe(meeting.id)
    expect(res.json().binding).toBe(false)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/admin/resolutions/${res.json().id}`,
      headers: { cookie: boardCookie },
      payload: { binding: true },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().binding).toBe(true)
    expect(patched.json().meetingId).toBe(meeting.id)
  })

  it('rejects a meetingId that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Bad link',
        body: 'x',
        votedAt: '2026-03-15T12:00:00.000Z',
        outcome: 'PASSED',
        voteFor: 3,
        voteAgainst: 0,
        voteAbstain: 0,
        meetingId: 'does-not-exist',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH publishes resolution', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/resolutions/${resolutionId}`,
      headers: { cookie: boardCookie },
      payload: { publishedAt: new Date().toISOString() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().publishedAt).toBeTruthy()
  })

  it('GET lists resolutions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ id: string }>
    expect(rows.some((r) => r.id === resolutionId)).toBe(true)
  })

  it('rejects a PASSED outcome whose vote counts do not support it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Mismatched outcome',
        body: 'x',
        votedAt: '2026-03-15T12:00:00.000Z',
        outcome: 'PASSED',
        voteFor: 0,
        voteAgainst: 100,
        voteAbstain: 0,
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a PATCH that flips outcome to PASSED against the stored vote counts', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/resolutions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Failed motion',
        body: 'x',
        votedAt: '2026-03-15T12:00:00.000Z',
        outcome: 'FAILED',
        voteFor: 2,
        voteAgainst: 8,
        voteAbstain: 0,
      },
    })
    expect(createRes.statusCode).toBe(201)
    const id = (createRes.json() as { id: string }).id

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/resolutions/${id}`,
      headers: { cookie: boardCookie },
      payload: { outcome: 'PASSED' },
    })
    expect(patchRes.statusCode).toBe(400)
  })
})
