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

const PREFIX = 'me-chat-'

describe('M11 — /api/me/chat', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let announcementId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'me-chat-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98390,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth for announcements', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/chat/announcements',
      payload: { body: 'Hello listeners' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('creates a channel announcement', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/chat/announcements',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { body: 'Next show Friday' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().body).toBe('Next show Friday')
    announcementId = res.json().id
  })

  it('deletes an announcement', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/chat/announcements/${announcementId}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
  })

  it('bans and unbans a chat fingerprint', async () => {
    const fingerprint = 'abc123def4567890abcdef1234567890abcdef12'

    const ban = await app.inject({
      method: 'POST',
      url: '/api/me/chat/ban',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { fingerprintHash: fingerprint },
    })
    expect(ban.statusCode).toBe(201)
    expect(ban.json()).toEqual({ ok: true })

    const unban = await app.inject({
      method: 'DELETE',
      url: `/api/me/chat/ban/${fingerprint}`,
      headers: { cookie },
    })
    expect(unban.statusCode).toBe(204)
  })
})
