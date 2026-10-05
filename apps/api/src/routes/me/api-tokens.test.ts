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

const PREFIX = 'api-token-test-'

describe('personal API tokens', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'api-token-test-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    userId = artist.id
  })

  afterAll(async () => {
    await prisma.apiToken.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a token, shows the secret once, then lists it masked', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'CI script' },
    })
    expect(create.statusCode).toBe(201)
    const body = create.json()
    expect(body.token).toMatch(/^tahti_/)
    expect(body.tokenPrefix).toBe(body.token.slice(0, body.tokenPrefix.length))
    expect(body.scopes).toEqual(['read'])

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/api-tokens',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const listed = list.json()
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(body.id)
    expect(listed[0].token).toBeUndefined()
  })

  it('rejects an empty name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('authenticates GET requests with a read-only bearer token', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'read-only' },
    })
    const token = create.json().token as string

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(me.statusCode).toBe(200)
  })

  it('blocks mutating requests with a read-only bearer token', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'read-only-2' },
    })
    const token = create.json().token as string

    const blocked = await app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { bio: 'should not be saved' },
    })
    expect(blocked.statusCode).toBe(403)
  })

  it('allows mutating requests with a write-scoped bearer token', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'read-write', scopes: ['read', 'write'] },
    })
    const token = create.json().token as string

    const saved = await app.inject({
      method: 'PATCH',
      url: '/api/me/profile',
      headers: { authorization: `Bearer ${token}` },
      payload: { bio: 'saved with a write token' },
    })
    expect(saved.statusCode).toBe(200)
  })

  it('never lets a token manage tokens, 2FA or account deletion', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'self-serving', scopes: ['read', 'write'] },
    })
    const token = create.json().token as string
    const id = create.json().id as string
    const authorization = `Bearer ${token}`
    const before = await prisma.apiToken.count({ where: { revokedAt: null } })

    const attempts = [
      { method: 'GET', url: '/api/me/api-tokens' },
      { method: 'POST', url: '/api/me/api-tokens', payload: { name: 'spawn', scopes: ['write'] } },
      { method: 'DELETE', url: `/api/me/api-tokens/${id}` },
      { method: 'POST', url: '/api/me/totp/setup' },
      { method: 'POST', url: '/api/me/totp/disable', payload: { code: '000000' } },
      {
        method: 'POST',
        url: '/api/me/account/deletion-request',
        payload: { reason: 'not me' },
      },
    ] as const
    for (const attempt of attempts) {
      const res = await app.inject({ ...attempt, headers: { authorization } })
      expect(res.statusCode, `${attempt.method} ${attempt.url}`).toBe(403)
      expect(res.json().code).toBe('session_required')
    }
    expect(await prisma.apiToken.count({ where: { revokedAt: null } })).toBe(before)

    const status = await app.inject({
      method: 'GET',
      url: '/api/me/totp/status',
      headers: { authorization },
    })
    expect(status.statusCode).toBe(200)
  })

  it('rejects an unknown or revoked bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/api-tokens',
      headers: { authorization: 'Bearer tahti_not-a-real-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('revokes a token so it can no longer authenticate', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'to-revoke' },
    })
    const { id, token } = create.json()

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/api-tokens/${id}`,
      headers: { cookie },
    })
    expect(del.statusCode).toBe(204)

    const reuse = await app.inject({
      method: 'GET',
      url: '/api/me/api-tokens',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(reuse.statusCode).toBe(401)
  })

  it('does not count expired tokens toward the limit', async () => {
    await prisma.apiToken.deleteMany({ where: { userId } })
    await prisma.apiToken.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        userId,
        name: `expired-${i}`,
        tokenHash: `api-token-test-expired-${i}-${Date.now()}`,
        tokenPrefix: 'tahti_ex',
        expiresAt: new Date(Date.now() - 60_000),
      })),
    })
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'after-expiry' },
    })
    expect(fresh.statusCode).toBe(201)

    await prisma.apiToken.updateMany({
      where: { userId, name: { startsWith: 'expired-' } },
      data: { expiresAt: new Date(Date.now() + 86_400_000) },
    })
    const full = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'one-too-many' },
    })
    expect(full.statusCode).toBe(400)
  })
})
