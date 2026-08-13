// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'publish-settings-test-'

describe('GET/PATCH /api/me/channel/publish-defaults', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'publish-settings-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('defaults to true', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/publish-defaults',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ autoPublishBroadcast: true })
  })

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/publish-defaults' })
    expect(res.statusCode).toBe(401)
  })

  it('persists a toggle to false', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/publish-defaults',
      headers: { cookie },
      payload: { autoPublishBroadcast: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json()).toEqual({ autoPublishBroadcast: false })

    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/publish-defaults',
      headers: { cookie },
    })
    expect(get.json()).toEqual({ autoPublishBroadcast: false })
  })

  it('rejects a non-boolean body', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/publish-defaults',
      headers: { cookie },
      payload: { autoPublishBroadcast: 'yes' },
    })
    expect(res.statusCode).toBe(400)
  })
})
