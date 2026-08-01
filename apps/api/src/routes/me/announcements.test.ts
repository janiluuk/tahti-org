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

const PREFIX = 'me-announcements-test-'

describe('/api/me/announcements', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    channelSlug = owner.channel!.slug
    cookie = await sessionCookieFor(prisma, owner.id)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires auth to prepare an upload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/prepare',
      payload: { filename: 'id.mp3', contentType: 'audio/mpeg', fileSizeBytes: 1000, title: 'ID' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('prepares an upload scoped to the caller channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/prepare',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { filename: 'id.mp3', contentType: 'audio/mpeg', fileSizeBytes: 1000, title: 'ID' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().uploadId).toMatch(new RegExp(`^announcements/own/${channelSlug}/`))
  })

  it('rejects completing an upload that does not belong to the caller channel', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/complete',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { uploadId: 'announcements/own/someone-else/x.mp3', title: 'ID' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('completes an upload, lists it, patches it, then deletes it', async () => {
    const uploadId = `announcements/own/${channelSlug}/x.mp3`
    const complete = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/complete',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { uploadId, title: 'Station ID', durationSec: 8 },
    })
    expect(complete.statusCode).toBe(201)
    expect(complete.json()).toMatchObject({
      title: 'Station ID',
      durationSec: 8,
      isEnabled: true,
      scheduleMode: 'RANDOM',
    })
    const clipId = complete.json().id

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/announcements',
      headers: { cookie },
    })
    expect(list.json().clips.map((c: { id: string }) => c.id)).toContain(clipId)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/announcements/${clipId}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { isEnabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().isEnabled).toBe(false)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/announcements/${clipId}`,
      headers: { cookie },
    })
    expect(del.statusCode).toBe(204)

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/me/announcements',
      headers: { cookie },
    })
    expect(listAfter.json().clips.map((c: { id: string }) => c.id)).not.toContain(clipId)
  })

  it('assigns and clears a clip as profile background music', async () => {
    const uploadId = `announcements/own/${channelSlug}/bg.mp3`
    const complete = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/complete',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { uploadId, title: 'Page loop', durationSec: 30 },
    })
    expect(complete.statusCode).toBe(201)
    const clipId = complete.json().id as string
    expect(complete.json().isProfileBackground).toBe(false)

    const assign = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/profile-background',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { clipId },
    })
    expect(assign.statusCode).toBe(200)
    expect(assign.json()).toEqual({ clipId })

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/announcements',
      headers: { cookie },
    })
    const row = list.json().clips.find((c: { id: string }) => c.id === clipId)
    expect(row?.isProfileBackground).toBe(true)

    const clear = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/profile-background',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { clipId: null },
    })
    expect(clear.statusCode).toBe(200)
    expect(clear.json()).toEqual({ clipId: null })

    await app.inject({
      method: 'DELETE',
      url: `/api/me/announcements/${clipId}`,
      headers: { cookie },
    })
  })

  it('404s patching/deleting another channel’s announcement', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)
    const uploadId = `announcements/own/${other.channel!.slug}/x.mp3`
    const complete = await app.inject({
      method: 'POST',
      url: '/api/me/announcements/complete',
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { uploadId, title: 'Other clip' },
    })
    const clipId = complete.json().id

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/announcements/${clipId}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { isEnabled: false },
    })
    expect(patch.statusCode).toBe(404)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/announcements/${clipId}`,
      headers: { cookie },
    })
    expect(del.statusCode).toBe(404)
  })
})
