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

const PREFIX = 'feature-request-test-'

describe('feature requests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberACookie: string
  let memberBCookie: string
  let boardCookie: string
  let nonMemberCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const memberA = await createTestArtist(prisma, {
      email: `${PREFIX}member-a@example.com`,
      username: 'feature-request-member-a',
      isMember: true,
    })
    const memberB = await createTestArtist(prisma, {
      email: `${PREFIX}member-b@example.com`,
      username: 'feature-request-member-b',
      isMember: true,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'feature-request-board',
      isMember: true,
      isBoard: true,
    })
    const nonMember = await createTestArtist(prisma, {
      email: `${PREFIX}nonmember@example.com`,
      username: 'feature-request-nonmember',
      isMember: false,
    })

    memberACookie = await sessionCookieFor(prisma, memberA.id)
    memberBCookie = await sessionCookieFor(prisma, memberB.id)
    boardCookie = await sessionCookieFor(prisma, board.id)
    nonMemberCookie = await sessionCookieFor(prisma, nonMember.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/governance/feature-requests' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for a logged-in non-member', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/feature-requests',
      headers: { cookie: nonMemberCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  let requestAId: string

  it('lets a member propose a feature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/feature-requests',
      headers: { cookie: memberACookie },
      payload: { title: 'Dark mode', description: 'Please add a dark theme option.' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe('Dark mode')
    expect(body.status).toBe('OPEN')
    expect(body.voteCount).toBe(0)
    requestAId = body.id
  })

  it('rejects an empty title', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/feature-requests',
      headers: { cookie: memberACookie },
      payload: { title: '', description: 'x' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('lists the request with youVoted false for another member', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/feature-requests',
      headers: { cookie: memberBCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ id: string; youVoted: boolean; voteCount: number }>
    const found = body.find((r) => r.id === requestAId)
    expect(found?.youVoted).toBe(false)
    expect(found?.voteCount).toBe(0)
  })

  it('lets a member vote', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/feature-requests/${requestAId}/vote`,
      headers: { cookie: memberBCookie },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ ok: true, voteCount: 1 })
  })

  it('rejects a duplicate vote from the same member', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/feature-requests/${requestAId}/vote`,
      headers: { cookie: memberBCookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('lets a member remove their vote', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/governance/feature-requests/${requestAId}/vote`,
      headers: { cookie: memberBCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, voteCount: 0 })

    // re-vote so later assertions (report generation) have a nonzero tally
    await app.inject({
      method: 'POST',
      url: `/api/v1/governance/feature-requests/${requestAId}/vote`,
      headers: { cookie: memberBCookie },
    })
  })

  it('lets a member post and read a discussion comment', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/feature-requests/${requestAId}/comments`,
      headers: { cookie: memberACookie },
      payload: { body: 'Would love a system-preference-aware toggle too.' },
    })
    expect(postRes.statusCode).toBe(201)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/feature-requests/${requestAId}/comments`,
      headers: { cookie: memberBCookie },
    })
    expect(listRes.statusCode).toBe(200)
    const comments = listRes.json() as Array<{ body: string; authorDisplayName: string | null }>
    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toContain('system-preference-aware')
  })

  it('forbids a non-board member from the admin list route', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/feature-requests',
      headers: { cookie: memberACookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lets the board mark a request planned, stamping the vote-in quarter', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/feature-requests/${requestAId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'PLANNED', reviewNote: 'Good idea, adding to the roadmap.' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('PLANNED')
    expect(body.reviewNote).toBe('Good idea, adding to the roadmap.')

    const stored = await prisma.featureRequest.findUniqueOrThrow({ where: { id: requestAId } })
    expect(stored.votedInYear).not.toBeNull()
    expect(stored.votedInQuarter).not.toBeNull()
  })

  let requestCId: string

  it('lets the board close a second request as a duplicate of the first', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/feature-requests',
      headers: { cookie: memberBCookie },
      payload: { title: 'Night theme', description: 'Same as dark mode really.' },
    })
    requestCId = createRes.json().id

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/feature-requests/${requestCId}`,
      headers: { cookie: boardCookie },
      payload: { mergedIntoId: requestAId },
    })
    expect(patchRes.statusCode).toBe(200)
    const body = patchRes.json()
    expect(body.status).toBe('DUPLICATE')
    expect(body.mergedIntoTitle).toBe('Dark mode')
  })

  it('rejects voting on a request marked as a duplicate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/feature-requests/${requestCId}/vote`,
      headers: { cookie: memberACookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('generates a quarterly report including the voted-in request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/feature-requests/reports',
      headers: { cookie: boardCookie },
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.markdown).toContain('Dark mode')
    expect(body.markdown).toContain('Voted in this quarter')

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/admin/feature-requests/reports',
      headers: { cookie: boardCookie },
    })
    expect(listRes.statusCode).toBe(200)
    const reports = listRes.json() as Array<{ year: number; quarter: number }>
    expect(reports.length).toBeGreaterThan(0)
  })
})
