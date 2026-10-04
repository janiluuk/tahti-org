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

const PREFIX = 'content-report-test-'

describe('content moderation reports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let reportId: string
  let soundId: string
  let channelSlug: string
  let commentId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'content-report-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    channelSlug = board.channel!.slug
    const sound = await prisma.sound.create({
      data: {
        channelId: board.channel!.id,
        title: 'Reported Track',
        status: 'READY',
        isPublic: true,
      },
    })
    soundId = sound.id
    const comment = await prisma.comment.create({
      data: { body: 'a rude comment', authorId: board.id, soundId },
    })
    commentId = comment.id
  })

  afterAll(async () => {
    await prisma.contentReport.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/v1/reports accepts an anonymous report, no auth required', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: {
        targetType: 'SOUND_ITEM',
        targetId: soundId,
        reason: 'COPYRIGHT',
        details: 'This is a re-upload of my track without permission.',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { ok: true; reportId: string }
    expect(body.ok).toBe(true)
    reportId = body.reportId
  })

  it('rejects an invalid targetType', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: { targetType: 'NOT_A_TYPE', targetId: 'x', reason: 'SPAM' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects a report about something that does not exist', async () => {
    for (const targetType of ['SOUND_ITEM', 'RELEASE', 'CHANNEL', 'COLLECTION', 'COMMENT']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        payload: { targetType, targetId: 'no-such-thing', reason: 'SPAM' },
      })
      expect(res.statusCode, targetType).toBe(404)
    }
  })

  it('accepts a report about a comment and about a channel by slug', async () => {
    const before = await prisma.contentReport.count()
    const comment = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: { targetType: 'COMMENT', targetId: commentId, reason: 'HARASSMENT' },
    })
    expect(comment.statusCode).toBe(201)
    const channel = await app.inject({
      method: 'POST',
      url: '/api/v1/reports',
      payload: { targetType: 'CHANNEL', targetId: channelSlug, reason: 'SPAM' },
    })
    expect(channel.statusCode).toBe(201)
    expect(await prisma.contentReport.count()).toBe(before + 2)
  })

  it('requires board auth for the admin list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/content-reports' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/content-reports lists the report, defaulting to OPEN status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content-reports?status=OPEN',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { reports: Array<{ id: string; targetId: string }> }
    expect(body.reports.some((r) => r.id === reportId && r.targetId === soundId)).toBe(true)
  })

  it('GET /api/admin/content-reports/:id returns the detail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/content-reports/${reportId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().reason).toBe('COPYRIGHT')
  })

  it('PATCH resolves the report and records who resolved it', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content-reports/${reportId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'ACTIONED', resolutionNote: 'Sound item removed by artist.' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      status: string
      resolvedByDisplayName: string | null
      resolvedAt: string | null
    }
    expect(body.status).toBe('ACTIONED')
    expect(body.resolvedByDisplayName).toBeTruthy()
    expect(body.resolvedAt).toBeTruthy()
  })

  it('reopening clears the resolution', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/content-reports/${reportId}`,
      headers: { cookie: boardCookie },
      payload: { status: 'REVIEWING' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { status: string; resolvedAt: string | null }
    expect(body.status).toBe('REVIEWING')
    expect(body.resolvedAt).toBeNull()
  })

  it('tells the board what was reported, and when it has since been removed', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/content-reports?limit=100',
      headers: { cookie: boardCookie },
    })
    type Row = {
      targetType: string
      targetId: string
      targetLabel: string | null
      targetUrl: string | null
      targetExcerpt: string | null
    }
    const reports = (list.json() as { reports: Row[] }).reports
    const track = reports.find((r) => r.targetType === 'SOUND_ITEM' && r.targetId === soundId)
    expect(track).toMatchObject({
      targetLabel: 'Reported Track',
      targetUrl: `/t/${soundId}`,
      targetExcerpt: null,
    })
    const comment = reports.find((r) => r.targetType === 'COMMENT' && r.targetId === commentId)
    expect(comment).toMatchObject({
      targetLabel: 'Comment by @content-report-board',
      targetUrl: `/t/${soundId}`,
      targetExcerpt: 'a rude comment',
    })

    await prisma.comment.delete({ where: { id: commentId } })
    const after = await app.inject({
      method: 'GET',
      url: '/api/admin/content-reports?limit=100',
      headers: { cookie: boardCookie },
    })
    const gone = (after.json() as { reports: Row[] }).reports.find(
      (r) => r.targetType === 'COMMENT' && r.targetId === commentId,
    )
    expect(gone).toMatchObject({ targetLabel: null, targetUrl: null, targetExcerpt: null })
  })

  it('returns 404 for an unknown report id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/content-reports/999999999',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
