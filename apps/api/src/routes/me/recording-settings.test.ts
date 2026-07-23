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

const PREFIX = 'recording-settings-'

describe('GET/PATCH /api/me/channel/recording', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'recording-settings-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/recording' })
    expect(res.statusCode).toBe(401)
  })

  it("defaults to enabled, matching today's unconditional recording behavior", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/recording',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().autoRecordEnabled).toBe(true)
  })

  it('can be turned off and back on', async () => {
    const off = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/recording',
      headers: { cookie },
      payload: { autoRecordEnabled: false },
    })
    expect(off.statusCode).toBe(200)
    expect(off.json().autoRecordEnabled).toBe(false)

    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/recording',
      headers: { cookie },
    })
    expect(get.json().autoRecordEnabled).toBe(false)

    const on = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/recording',
      headers: { cookie },
      payload: { autoRecordEnabled: true },
    })
    expect(on.json().autoRecordEnabled).toBe(true)
  })

  it('rejects a non-boolean payload', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/recording',
      headers: { cookie },
      payload: { autoRecordEnabled: 'yes' },
    })
    expect(res.statusCode).toBe(400)
  })
})
