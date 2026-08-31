// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/governance-document.pdf'),
}))

const PREFIX = 'governance-records-test-'

describe('governance meetings and documents', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.governanceDocument.deleteMany({})
    await prisma.governanceMeeting.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-records-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-records-member',
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await prisma.governanceDocument.deleteMany({})
    await prisma.governanceMeeting.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('persists a board meeting with agenda and keeps drafts private', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings',
      headers: { cookie: boardCookie },
      payload: {
        title: '2026 annual general meeting',
        type: 'GENERAL',
        scheduledAt: '2026-03-28T12:00:00.000Z',
        location: 'Helsinki / video call',
        eligibleMemberCount: 2,
        quorumRequired: 2,
        agenda: [{ title: 'Approve annual accounts' }, { title: 'Elect the board' }],
      },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json().state).toBe('DRAFT')
    expect(create.json().quorumMet).toBe(false)

    const memberList = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/meetings',
      headers: { cookie: memberCookie },
    })
    expect(memberList.statusCode).toBe(200)
    expect(memberList.json()).toHaveLength(0)
  })

  it('publishes a scheduled meeting and an official document to members', async () => {
    const meeting = await prisma.governanceMeeting.findFirstOrThrow()
    const update = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meeting.id}`,
      headers: { cookie: boardCookie },
      payload: { state: 'SCHEDULED', noticeAt: '2026-03-01T12:00:00.000Z' },
    })
    expect(update.statusCode).toBe(200)

    const attendance = await app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meeting.id}/attendance`,
      headers: { cookie: boardCookie },
      payload: { displayName: 'Chair', status: 'PRESENT' },
    })
    expect(attendance.statusCode).toBe(201)

    const secondAttendance = await app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meeting.id}/attendance`,
      headers: { cookie: boardCookie },
      payload: { displayName: 'Secretary', status: 'PRESENT' },
    })
    expect(secondAttendance.statusCode).toBe(201)

    const meetingList = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/meetings',
      headers: { cookie: memberCookie },
    })
    expect(meetingList.json()[0]).toMatchObject({
      attendanceCount: 2,
      presentCount: 2,
      quorumMet: true,
    })

    const document = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/documents',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Tahti ry bylaws',
        type: 'BYLAWS',
        version: 1,
        storageKey: 'governance/bylaws-v1.pdf',
        publishedAt: '2026-03-01T12:00:00.000Z',
      },
    })
    expect(document.statusCode).toBe(201)
    expect(document.json().downloadUrl).toContain('governance-document.pdf')

    const memberDocuments = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/documents',
      headers: { cookie: memberCookie },
    })
    expect(memberDocuments.statusCode).toBe(200)
    expect(memberDocuments.json()[0]).toMatchObject({
      title: 'Tahti ry bylaws',
      type: 'BYLAWS',
      version: 1,
    })

    const memberMeetings = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/meetings',
      headers: { cookie: memberCookie },
    })
    expect(memberMeetings.statusCode).toBe(200)
    expect(memberMeetings.json()[0]).toMatchObject({
      title: '2026 annual general meeting',
      state: 'SCHEDULED',
      eligibleMemberCount: 2,
      quorumRequired: 2,
      quorumMet: true,
    })
  })

  it('does not expose governance records to non-members', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/governance/documents' })
    expect(response.statusCode).toBe(401)
  })
})
