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

const PREFIX = 'me-moderators-'

describe('M27 — /api/me/channel/moderators and /api/me/moderate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let modCookie: string
  let outsiderCookie: string
  let ownerSlug: string
  let modUserId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'me-mods-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98490,
    })
    const moderator = await createTestArtist(prisma, {
      email: `${PREFIX}mod@example.com`,
      username: 'me-mods-mod',
      memberNumber: 98491,
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: 'me-mods-outsider',
      memberNumber: 98492,
    })

    ownerSlug = owner.channel!.slug
    modUserId = moderator.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    modCookie = await sessionCookieFor(prisma, moderator.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/moderators' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects delegating to yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/moderators',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { username: 'me-mods-owner' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 adding an unknown username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/moderators',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { username: 'no-such-user-anywhere' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('owner delegates moderation to a trusted listener', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/moderators',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { username: 'me-mods-mod' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ userId: modUserId, username: 'me-mods-mod' })
  })

  it('owner lists delegated moderators', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/moderators',
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      expect.objectContaining({ userId: modUserId, username: 'me-mods-mod' }),
    ])
  })

  it('moderator sees the channel under /api/me/moderate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/moderate',
      headers: { cookie: modCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: ownerSlug, isOwner: false })]),
    )
  })

  it('outsider cannot moderate the channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${ownerSlug}/chat/bans`,
      headers: { cookie: outsiderCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('moderator can ban, list, and unban a chat fingerprint on the moderated channel', async () => {
    const fingerprint = 'abc123def4567890abcdef1234567890abcdef12'

    const ban = await app.inject({
      method: 'POST',
      url: `/api/me/moderate/${ownerSlug}/chat/ban`,
      headers: { cookie: modCookie, 'content-type': 'application/json' },
      payload: { fingerprintHash: fingerprint },
    })
    expect(ban.statusCode).toBe(201)
    expect(ban.json()).toEqual({ ok: true })

    const list = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${ownerSlug}/chat/bans`,
      headers: { cookie: modCookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual([expect.objectContaining({ fingerprintHash: fingerprint })])

    const unban = await app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${ownerSlug}/chat/ban/${fingerprint}`,
      headers: { cookie: modCookie },
    })
    expect(unban.statusCode).toBe(204)

    const listAfter = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${ownerSlug}/chat/bans`,
      headers: { cookie: modCookie },
    })
    expect(listAfter.json()).toEqual([])
  })

  it('owner revokes moderator access', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/moderators/${modUserId}`,
      headers: { cookie: ownerCookie },
    })
    expect(del.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${ownerSlug}/chat/bans`,
      headers: { cookie: modCookie },
    })
    expect(after.statusCode).toBe(404)
  })
})
