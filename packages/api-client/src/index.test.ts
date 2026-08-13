// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Connectivity tests for the generated SDK: these hit a real HTTP listener
// (not Fastify's in-process `.inject()`, which the rest of apps/api's test
// suite uses) so we're actually exercising createTahtiClient's fetch layer,
// header handling, and openapi-fetch's typed error/data union — the same
// path frontend code goes through.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '@tahti/api/server'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '@tahti/api/test/helpers'
import { createTahtiClient } from './index.js'

const PREFIX = 'sdk-connectivity-test-'

describe('@tahti/api-client connectivity', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let baseUrl: string
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' })

    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sdk-connectivity-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('fetches an unauthenticated endpoint (plain object payload)', async () => {
    const api = createTahtiClient({ baseUrl })
    const { data, error, response } = await api.GET('/health')
    expect(response.status).toBe(200)
    expect(error).toBeUndefined()
    expect(data?.status).toMatch(/ok|degraded|error/)
  })

  it('returns a typed 401 error with no session or token', async () => {
    const api = createTahtiClient({ baseUrl })
    const { data, error, response } = await api.GET('/api/me/api-tokens')
    expect(response.status).toBe(401)
    expect(data).toBeUndefined()
    expect(error).toBeDefined()
  })

  it('authenticates via a forwarded session cookie and returns an empty list', async () => {
    const api = createTahtiClient({ baseUrl, cookie })
    const { data, error } = await api.GET('/api/me/api-tokens')
    expect(error).toBeUndefined()
    expect(data).toEqual([])
  })

  it('surfaces a 400 validation error for an invalid request body', async () => {
    const api = createTahtiClient({ baseUrl, cookie })
    const { data, response } = await api.POST('/api/me/api-tokens', {
      body: { name: '' },
    })
    expect(response.status).toBe(400)
    expect(data).toBeUndefined()
  })

  it('creates a token (populated object), then lists it (populated array)', async () => {
    const api = createTahtiClient({ baseUrl, cookie })

    const created = await api.POST('/api/me/api-tokens', {
      body: { name: 'sdk test token', scopes: ['read', 'write'] },
    })
    expect(created.response.status).toBe(201)
    expect(created.data?.token).toMatch(/^tahti_/)

    const list = await api.GET('/api/me/api-tokens')
    expect(list.data).toHaveLength(1)
    expect(list.data?.[0]?.id).toBe(created.data?.id)

    // Same SDK, switched to bearer-token auth instead of the cookie — proves
    // the client works unmodified for the third-party / scripted use case.
    const tokenApi = createTahtiClient({ baseUrl, token: created.data!.token })
    const viaToken = await tokenApi.GET('/api/me/api-tokens')
    expect(viaToken.data).toHaveLength(1)

    const revoke = await tokenApi.DELETE('/api/me/api-tokens/{id}', {
      params: { path: { id: created.data!.id } },
    })
    expect(revoke.response.status).toBe(204)
  })

  it('rejects an unrecognized bearer token', async () => {
    const api = createTahtiClient({ baseUrl, token: 'tahti_not-a-real-token' })
    const { response } = await api.GET('/api/me/api-tokens')
    expect(response.status).toBe(401)
  })
})
