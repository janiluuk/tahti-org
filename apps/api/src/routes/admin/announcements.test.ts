// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-announcements-test-'

describe('/api/admin/announcements', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let plainCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.announcementSettings.deleteMany({})

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const plain = await createTestArtist(prisma, {
      email: `${PREFIX}plain@example.com`,
      username: `${PREFIX}plain`,
    })
    plainCookie = await sessionCookieFor(prisma, plain.id)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.announcementSettings.deleteMany({})
  })

  it('requires board auth for every route', async () => {
    const prepare = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements/prepare',
      headers: { cookie: plainCookie, 'content-type': 'application/json' },
      payload: { filename: 'id.mp3', contentType: 'audio/mpeg', fileSizeBytes: 1000, title: 'ID' },
    })
    expect(prepare.statusCode).toBe(403)

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/announcements',
      headers: { cookie: plainCookie },
    })
    expect(list.statusCode).toBe(403)

    const anon = await app.inject({ method: 'GET', url: '/api/admin/announcements' })
    expect(anon.statusCode).toBe(401)
  })

  it('prepares a system upload under the system prefix', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements/prepare',
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { filename: 'id.mp3', contentType: 'audio/mpeg', fileSizeBytes: 1000, title: 'ID' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().uploadId).toMatch(/^announcements\/system\//)
  })

  it('rejects completing a non-system-prefixed upload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements/complete',
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { uploadId: 'announcements/own/someone/x.mp3', title: 'ID' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('completes, lists, patches scheduling, and deletes a system clip', async () => {
    const complete = await app.inject({
      method: 'POST',
      url: '/api/admin/announcements/complete',
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { uploadId: 'announcements/system/x.mp3', title: 'System ID' },
    })
    expect(complete.statusCode).toBe(201)
    const clipId = complete.json().id

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/announcements',
      headers: { cookie: boardCookie },
    })
    expect(list.json().clips.map((c: { id: string }) => c.id)).toContain(clipId)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/announcements/${clipId}`,
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { scheduleMode: 'EVERY_NTH', everyNth: 4 },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json()).toMatchObject({ scheduleMode: 'EVERY_NTH', everyNth: 4 })

    const badPatch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/announcements/${clipId}`,
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { scheduleMode: 'EVERY_NTH' },
    })
    expect(badPatch.statusCode).toBe(400)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/admin/announcements/${clipId}`,
      headers: { cookie: boardCookie },
    })
    expect(del.statusCode).toBe(204)
  })

  it('reads and writes the global kill-switch, defaulting to enabled', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/admin/announcements/settings',
      headers: { cookie: boardCookie },
    })
    expect(initial.json()).toEqual({ systemEnabled: true })

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/admin/announcements/settings',
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: { systemEnabled: false },
    })
    expect(patch.json()).toEqual({ systemEnabled: false })

    const after = await app.inject({
      method: 'GET',
      url: '/api/admin/announcements/settings',
      headers: { cookie: boardCookie },
    })
    expect(after.json()).toEqual({ systemEnabled: false })
  })
})
