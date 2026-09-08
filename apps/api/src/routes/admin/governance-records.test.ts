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
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/upload-minutes'),
}))

const sendGovernanceMeetingNoticeEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/email.js', () => ({
  sendGovernanceMeetingNoticeEmail: (...args: unknown[]) =>
    sendGovernanceMeetingNoticeEmail(...args),
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
        chairName: 'Chair',
        secretaryName: 'Secretary',
        agenda: [{ title: 'Approve annual accounts' }, { title: 'Elect the board' }],
      },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json().state).toBe('DRAFT')
    const meetingId = create.json().id as string

    const audited = await app.inject({
      method: 'GET',
      url: `/api/admin/audit?topic=meetings&targetId=${meetingId}`,
      headers: { cookie: boardCookie },
    })
    expect(audited.statusCode).toBe(200)
    expect(
      (audited.json() as { items: Array<{ action: string }> }).items.some(
        (item) => item.action === 'MEETING_CREATE',
      ),
    ).toBe(true)
    expect(create.json().quorumMet).toBe(false)
    expect(create.json()).toMatchObject({
      chairName: 'Chair',
      secretaryName: 'Secretary',
      minutesSignedByName: null,
      minutesSignedAt: null,
    })

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

  it('records chair, secretary, and a minutes signature snapshot', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings',
      headers: { cookie: boardCookie },
      payload: {
        title: 'June 2026 board meeting',
        type: 'BOARD',
        chairName: 'Aino Chair',
        secretaryName: 'Simo Secretary',
      },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json()).toMatchObject({
      chairName: 'Aino Chair',
      secretaryName: 'Simo Secretary',
      minutesSignedByName: null,
    })
    const meetingId = create.json().id as string

    const signed = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: {
        state: 'SCHEDULED',
        minutesSignedByName: 'Aino Chair',
        minutesSignedAt: '2026-06-15T18:00:00.000Z',
      },
    })
    expect(signed.statusCode).toBe(200)
    expect(signed.json()).toMatchObject({
      chairName: 'Aino Chair',
      secretaryName: 'Simo Secretary',
      minutesSignedByName: 'Aino Chair',
      minutesSignedAt: '2026-06-15T18:00:00.000Z',
    })

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { secretaryName: '' },
    })
    expect(cleared.statusCode).toBe(200)
    expect(cleared.json().secretaryName).toBeNull()

    const memberList = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/meetings',
      headers: { cookie: memberCookie },
    })
    expect(memberList.statusCode).toBe(200)
    const row = (memberList.json() as Array<{ title: string; chairName: string | null }>).find(
      (meeting) => meeting.title === 'June 2026 board meeting',
    )
    expect(row).toMatchObject({
      chairName: 'Aino Chair',
      secretaryName: null,
      minutesSignedByName: 'Aino Chair',
    })
  })

  it('audits notice publication and each minutes-workflow step distinctly', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings',
      headers: { cookie: boardCookie },
      payload: { title: 'September 2026 board meeting', type: 'BOARD' },
    })
    expect(create.statusCode).toBe(201)
    const meetingId = create.json().id as string

    const noticed = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { noticeAt: '2026-09-01T12:00:00.000Z' },
    })
    expect(noticed.statusCode).toBe(200)

    const uploaded = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'MINUTES_DRAFT', minutesKey: 'governance/minutes-sept-2026.pdf' },
    })
    expect(uploaded.statusCode).toBe(200)

    const approved = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { minutesApprovedAt: '2026-09-05T12:00:00.000Z' },
    })
    expect(approved.statusCode).toBe(200)

    const signed = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: {
        state: 'APPROVED',
        minutesSignedByName: 'Aino Chair',
        minutesSignedAt: '2026-09-06T12:00:00.000Z',
      },
    })
    expect(signed.statusCode).toBe(200)

    const redacted = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { minutesRedacted: true },
    })
    expect(redacted.statusCode).toBe(200)
    expect(redacted.json().minutesRedacted).toBe(true)

    const published = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { minutesPublishedAt: '2026-09-07T12:00:00.000Z' },
    })
    expect(published.statusCode).toBe(200)
    expect(published.json().minutesPublishedAt).toBe('2026-09-07T12:00:00.000Z')

    const fetchTopic = async (topic: string) => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/audit?topic=${topic}&targetId=${meetingId}`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      return (res.json() as { items: Array<{ action: string }> }).items.map((i) => i.action)
    }

    expect(await fetchTopic('notices')).toEqual(
      expect.arrayContaining(['MEETING_NOTICE_PUBLISH', 'MEETING_NOTICE_SEND']),
    )
    const minutesActions = await fetchTopic('minutes')
    expect(minutesActions).toEqual(
      expect.arrayContaining([
        'MINUTES_UPLOAD',
        'MINUTES_APPROVE',
        'MINUTES_SIGN',
        'MINUTES_REDACT',
        'MINUTES_PUBLISH',
      ]),
    )

    // Both board and member fixtures have isMember: true, so both are
    // eligible recipients of the notice sent when noticeAt was first set.
    expect(sendGovernanceMeetingNoticeEmail).toHaveBeenCalled()
    const deliveries = await app.inject({
      method: 'GET',
      url: `/api/admin/governance/meetings/${meetingId}/notice-deliveries`,
      headers: { cookie: boardCookie },
    })
    expect(deliveries.statusCode).toBe(200)
    const deliveryRows = deliveries.json() as Array<{ email: string; bouncedAt: string | null }>
    expect(deliveryRows.length).toBeGreaterThanOrEqual(2)
    expect(deliveryRows.every((row) => row.bouncedAt === null)).toBe(true)

    // Re-saving the meeting with the same noticeAt must not re-send/re-audit.
    const sendCallsBefore = sendGovernanceMeetingNoticeEmail.mock.calls.length
    const resaved = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { noticeAt: '2026-09-01T12:00:00.000Z' },
    })
    expect(resaved.statusCode).toBe(200)
    expect(sendGovernanceMeetingNoticeEmail.mock.calls.length).toBe(sendCallsBefore)
    const noticeSendCount = (await fetchTopic('notices')).filter(
      (a) => a === 'MEETING_NOTICE_SEND',
    ).length
    expect(noticeSendCount).toBe(1)
  })

  it('records a declared conflict of interest and audits it', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings',
      headers: { cookie: boardCookie },
      payload: { title: 'October 2026 board meeting', type: 'BOARD' },
    })
    expect(create.statusCode).toBe(201)
    const meetingId = create.json().id as string

    const declared = await app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meetingId}/conflicts`,
      headers: { cookie: boardCookie },
      payload: {
        displayName: 'Board Member X',
        matter: 'Vendor contract with a company they co-own',
        recused: true,
      },
    })
    expect(declared.statusCode).toBe(201)
    expect(declared.json()).toMatchObject({
      displayName: 'Board Member X',
      matter: 'Vendor contract with a company they co-own',
      recused: true,
    })

    const list = await app.inject({
      method: 'GET',
      url: `/api/admin/governance/meetings/${meetingId}/conflicts`,
      headers: { cookie: boardCookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toHaveLength(1)

    const audit = await app.inject({
      method: 'GET',
      url: `/api/admin/audit?topic=conflicts&targetId=${meetingId}`,
      headers: { cookie: boardCookie },
    })
    expect(audit.statusCode).toBe(200)
    expect(
      (audit.json() as { items: Array<{ action: string }> }).items.some(
        (item) => item.action === 'CONFLICT_DECLARE',
      ),
    ).toBe(true)
  })

  it('404s a conflict declaration for a nonexistent meeting', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings/does-not-exist/conflicts',
      headers: { cookie: boardCookie },
      payload: { displayName: 'X', matter: 'Y' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('prepares a presigned minutes upload and exposes a download URL once minutesKey is set', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/meetings',
      headers: { cookie: boardCookie },
      payload: { title: 'October 2026 board meeting', type: 'BOARD' },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json().minutesUrl).toBeNull()
    const meetingId = create.json().id as string

    const prepared = await app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meetingId}/minutes/prepare-upload`,
      headers: { cookie: boardCookie },
      payload: { contentType: 'application/pdf', fileSizeBytes: 1024 },
    })
    expect(prepared.statusCode).toBe(200)
    const { uploadUrl, minutesKey, expiresAt } = prepared.json() as {
      uploadUrl: string
      minutesKey: string
      expiresAt: string
    }
    expect(uploadUrl).toBe('https://minio.test/upload-minutes')
    expect(minutesKey).toContain(`governance/meetings/${meetingId}/minutes-`)
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())

    const finalized = await app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/meetings/${meetingId}`,
      headers: { cookie: boardCookie },
      payload: { minutesKey },
    })
    expect(finalized.statusCode).toBe(200)
    expect(finalized.json().minutesUrl).toContain('governance-document.pdf')

    // A non-board member can't prepare an upload.
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/admin/governance/meetings/${meetingId}/minutes/prepare-upload`,
      headers: { cookie: memberCookie },
      payload: { contentType: 'application/pdf', fileSizeBytes: 1024 },
    })
    expect(forbidden.statusCode).toBe(403)
  })

  it('does not expose governance records to non-members', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/governance/documents' })
    expect(response.statusCode).toBe(401)
  })
})
