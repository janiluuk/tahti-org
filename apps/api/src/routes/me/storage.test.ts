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
import { DEFAULT_QUOTA_BYTES } from '../../lib/storage-quota.js'

const PREFIX = 'me-storage-test-'

describe('GET /api/me/storage', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/storage' })
    expect(res.statusCode).toBe(401)
  })

  it('lazily creates a quota row with the 500MB default on first check', async () => {
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const cookie = await sessionCookieFor(prisma, owner.id)

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/storage',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.quotaBytes).toBe(Number(DEFAULT_QUOTA_BYTES))
    expect(body.usedBytes).toBe(0)
  })
})
